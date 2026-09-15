/**
 * Streaming peak extraction for uncompressed PCM containers (WAV / AIFF / AIFC).
 *
 * Designed so a 500MB multitrack WAV can be analysed straight from an R2 stream
 * with O(bucketCount) memory: headers are parsed incrementally, then PCM frames
 * are folded into a fixed number of buckets as chunks arrive.
 */

export const WAVEFORM_VERSION = 1;
export const DEFAULT_WAVEFORM_BUCKETS = 1000;
/** Upper bound on frames inspected per bucket (stride sampling above this). */
const MAX_FRAMES_SAMPLED_PER_BUCKET = 4096;

export type PcmEncoding = 'int' | 'float';

export interface PcmFormat {
  container: 'wav' | 'aiff';
  sampleRate: number;
  channels: number;
  bitDepth: number;
  encoding: PcmEncoding;
  littleEndian: boolean;
  /** WAV 8-bit is unsigned; everything else is signed. */
  unsigned8: boolean;
  /** Byte length of the PCM payload, or null when unknown (streamed WAV with size 0). */
  dataLength: number | null;
}

export interface WaveformPeaksResult {
  version: number;
  peaks: number[];
  sampleRate: number;
  channels: number;
  durationMs: number;
  frames: number;
}

/** Fold per-frame max-abs values into a fixed set of buckets. */
export class PeakAccumulator {
  private readonly sums: Float64Array;
  private readonly bucketCount: number;
  private readonly totalFrames: number;
  private readonly stride: number;
  private frameIndex = 0;
  private maxSeen = 0;

  constructor(totalFrames: number, bucketCount = DEFAULT_WAVEFORM_BUCKETS) {
    this.bucketCount = Math.max(1, bucketCount);
    this.totalFrames = Math.max(1, totalFrames);
    this.sums = new Float64Array(this.bucketCount);
    const framesPerBucket = this.totalFrames / this.bucketCount;
    this.stride = Math.max(1, Math.floor(framesPerBucket / MAX_FRAMES_SAMPLED_PER_BUCKET));
  }

  /** Whether the next frame should be inspected (stride sampling). */
  shouldSample(): boolean {
    return this.frameIndex % this.stride === 0;
  }

  /** Record a frame's peak (already reduced across channels). */
  pushFrame(peak: number): void {
    const bucket = Math.min(this.bucketCount - 1, Math.floor((this.frameIndex / this.totalFrames) * this.bucketCount));
    if (peak > this.sums[bucket]) this.sums[bucket] = peak;
    if (peak > this.maxSeen) this.maxSeen = peak;
    this.frameIndex += 1;
  }

  /** Advance the frame counter without inspecting (used when striding). */
  skipFrame(): void {
    this.frameIndex += 1;
  }

  get framesSeen(): number {
    return this.frameIndex;
  }

  /** Normalised 0–255 peaks (quiet tracks fill the view; silence stays flat). */
  toPeaks(): number[] {
    const out = new Array<number>(this.bucketCount);
    const scale = this.maxSeen > 0 ? 255 / this.maxSeen : 0;
    for (let i = 0; i < this.bucketCount; i++) {
      out[i] = Math.round(this.sums[i] * scale);
    }
    return out;
  }
}

function fourCC(buf: Buffer, offset: number): string {
  return buf.toString('latin1', offset, offset + 4);
}

/** 80-bit IEEE extended (big-endian) → number, as used by AIFF COMM sample rate. */
function readExtendedFloat80(buf: Buffer, offset: number): number {
  const exponent = buf.readUInt16BE(offset);
  const hi = buf.readUInt32BE(offset + 2);
  const lo = buf.readUInt32BE(offset + 6);
  if (exponent === 0 && hi === 0 && lo === 0) return 0;
  const sign = exponent & 0x8000 ? -1 : 1;
  const exp = (exponent & 0x7fff) - 16383;
  const mantissa = hi * 2 ** 32 + lo;
  return sign * (mantissa / 2 ** 63) * 2 ** exp;
}

/** Read one sample as a value in [-1, 1]. */
function readSample(buf: Buffer, offset: number, fmt: PcmFormat): number {
  switch (fmt.bitDepth) {
    case 8:
      return fmt.unsigned8 ? (buf[offset] - 128) / 128 : buf.readInt8(offset) / 128;
    case 16:
      return (fmt.littleEndian ? buf.readInt16LE(offset) : buf.readInt16BE(offset)) / 32768;
    case 24: {
      let v: number;
      if (fmt.littleEndian) {
        v = buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16);
      } else {
        v = (buf[offset] << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
      }
      if (v & 0x800000) v -= 0x1000000;
      return v / 8388608;
    }
    case 32:
      if (fmt.encoding === 'float') {
        return fmt.littleEndian ? buf.readFloatLE(offset) : buf.readFloatBE(offset);
      }
      return (fmt.littleEndian ? buf.readInt32LE(offset) : buf.readInt32BE(offset)) / 2147483648;
    case 64:
      return fmt.littleEndian ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
    default:
      return 0;
  }
}

type AnalyzerState = 'container_header' | 'chunk_header' | 'chunk_body' | 'skip' | 'ssnd_header' | 'pcm' | 'done';

/**
 * Incremental WAV/AIFF parser + peak folder. Feed arbitrary byte chunks via `push`,
 * then call `finish()`.
 */
export class PcmStreamAnalyzer {
  private state: AnalyzerState = 'container_header';
  private pending: Buffer = Buffer.alloc(0);
  private container: 'wav' | 'aiff' | null = null;
  private currentChunkId = '';
  private currentChunkSize = 0;
  private skipRemaining = 0;
  private pcmRemaining: number | null = null;
  private format: PcmFormat | null = null;
  private accumulator: PeakAccumulator | null = null;
  private frameBytes = 0;
  private aiffFrames = 0;
  private aiffCompression = 'NONE';
  /** Continuation to run once a `skip` completes (used for SSND leading offset). */
  private afterSkip: (() => void) | null = null;

  constructor(
    private readonly totalFileBytes: number,
    private readonly bucketCount = DEFAULT_WAVEFORM_BUCKETS
  ) {}

  get detectedFormat(): PcmFormat | null {
    return this.format;
  }

  push(chunk: Buffer): void {
    if (this.state === 'done') return;
    this.pending = this.pending.length ? Buffer.concat([this.pending, chunk]) : chunk;

    // Loop until we cannot make progress with the bytes we have.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // `consumePcm` may flip the state to done mid-loop; TS can't see that mutation.
      if ((this.state as AnalyzerState) === 'done') {
        this.pending = Buffer.alloc(0);
        return;
      }

      if (this.state === 'container_header') {
        if (this.pending.length < 12) return;
        const id = fourCC(this.pending, 0);
        const type = fourCC(this.pending, 8);
        if (id === 'RIFF' && type === 'WAVE') this.container = 'wav';
        else if (id === 'FORM' && (type === 'AIFF' || type === 'AIFC')) this.container = 'aiff';
        else throw new Error('Not a WAV or AIFF file');
        this.pending = this.pending.subarray(12);
        this.state = 'chunk_header';
        continue;
      }

      if (this.state === 'chunk_header') {
        if (this.pending.length < 8) return;
        this.currentChunkId = fourCC(this.pending, 0);
        this.currentChunkSize = this.container === 'wav' ? this.pending.readUInt32LE(4) : this.pending.readUInt32BE(4);
        this.pending = this.pending.subarray(8);

        if (this.container === 'wav' && this.currentChunkId === 'data') {
          this.beginPcm(
            this.currentChunkSize === 0 || this.currentChunkSize === 0xffffffff ? null : this.currentChunkSize
          );
          continue;
        }
        if (this.container === 'aiff' && this.currentChunkId === 'SSND') {
          this.state = 'ssnd_header';
          continue;
        }
        if (
          (this.container === 'wav' && this.currentChunkId === 'fmt ') ||
          (this.container === 'aiff' && this.currentChunkId === 'COMM')
        ) {
          this.state = 'chunk_body';
          continue;
        }
        // Skip everything else (LIST, bext, iXML, cue, etc.), honouring padding.
        this.skipRemaining = this.currentChunkSize + (this.currentChunkSize % 2);
        this.state = 'skip';
        continue;
      }

      if (this.state === 'chunk_body') {
        const need = this.currentChunkSize + (this.currentChunkSize % 2);
        if (this.pending.length < need) return;
        const body = this.pending.subarray(0, this.currentChunkSize);
        if (this.container === 'wav') this.parseWavFmt(body);
        else this.parseAiffComm(body);
        this.pending = this.pending.subarray(need);
        this.state = 'chunk_header';
        continue;
      }

      if (this.state === 'skip') {
        const take = Math.min(this.skipRemaining, this.pending.length);
        this.pending = this.pending.subarray(take);
        this.skipRemaining -= take;
        if (this.skipRemaining > 0) return;
        if (this.afterSkip) {
          const next = this.afterSkip;
          this.afterSkip = null;
          next();
        } else {
          this.state = 'chunk_header';
        }
        continue;
      }

      if (this.state === 'ssnd_header') {
        if (this.pending.length < 8) return;
        const offset = this.pending.readUInt32BE(0);
        this.pending = this.pending.subarray(8);
        const pcmLength = Math.max(0, this.currentChunkSize - 8 - offset);
        if (offset > 0) {
          // Rare: leading pad bytes inside SSND. Skip them, then start PCM.
          this.skipRemaining = offset;
          this.afterSkip = () => this.beginPcm(pcmLength);
          this.state = 'skip';
          continue;
        }
        this.beginPcm(pcmLength);
        continue;
      }

      if (this.state === 'pcm') {
        this.consumePcm();
        return;
      }
    }
  }

  private beginPcm(dataLength: number | null): void {
    if (!this.format) {
      throw new Error(`Missing ${this.container === 'wav' ? 'fmt ' : 'COMM'} chunk before audio data`);
    }
    this.format.dataLength = dataLength;
    this.frameBytes = (this.format.bitDepth / 8) * this.format.channels;
    if (this.frameBytes <= 0) throw new Error('Invalid PCM frame size');

    let totalFrames: number;
    if (this.container === 'aiff' && this.aiffFrames > 0) {
      totalFrames = this.aiffFrames;
    } else if (dataLength != null && dataLength > 0) {
      totalFrames = Math.floor(dataLength / this.frameBytes);
    } else {
      // Unknown data size: estimate from the remaining file bytes.
      totalFrames = Math.max(1, Math.floor((this.totalFileBytes - 44) / this.frameBytes));
    }

    this.accumulator = new PeakAccumulator(totalFrames, this.bucketCount);
    this.pcmRemaining = dataLength;
    this.state = 'pcm';
  }

  private consumePcm(): void {
    const fmt = this.format!;
    const acc = this.accumulator!;
    let available = this.pending.length;
    if (this.pcmRemaining != null) available = Math.min(available, this.pcmRemaining);

    const frames = Math.floor(available / this.frameBytes);
    const bytesPerSample = fmt.bitDepth / 8;
    let offset = 0;

    for (let f = 0; f < frames; f++) {
      if (acc.shouldSample()) {
        let peak = 0;
        for (let c = 0; c < fmt.channels; c++) {
          const v = Math.abs(readSample(this.pending, offset + c * bytesPerSample, fmt));
          if (v > peak) peak = v;
        }
        acc.pushFrame(peak);
      } else {
        acc.skipFrame();
      }
      offset += this.frameBytes;
    }

    this.pending = this.pending.subarray(offset);
    if (this.pcmRemaining != null) {
      this.pcmRemaining -= offset;
      if (this.pcmRemaining < this.frameBytes) {
        this.state = 'done';
        this.pending = Buffer.alloc(0);
      }
    }
  }

  private parseWavFmt(body: Buffer): void {
    if (body.length < 16) throw new Error('Malformed fmt chunk');
    let formatTag = body.readUInt16LE(0);
    const channels = body.readUInt16LE(2);
    const sampleRate = body.readUInt32LE(4);
    const bitDepth = body.readUInt16LE(14);

    if (formatTag === 0xfffe && body.length >= 26) {
      // WAVE_FORMAT_EXTENSIBLE: real format lives in the first 2 bytes of the SubFormat GUID
      formatTag = body.readUInt16LE(24);
    }

    let encoding: PcmEncoding;
    if (formatTag === 1) encoding = 'int';
    else if (formatTag === 3) encoding = 'float';
    else throw new Error(`Unsupported WAV format tag 0x${formatTag.toString(16)}`);

    if (![8, 16, 24, 32, 64].includes(bitDepth)) {
      throw new Error(`Unsupported WAV bit depth ${bitDepth}`);
    }
    if (encoding === 'float' && bitDepth !== 32 && bitDepth !== 64) {
      throw new Error(`Unsupported float WAV bit depth ${bitDepth}`);
    }
    if (!channels || !sampleRate) throw new Error('Invalid WAV header');

    this.format = {
      container: 'wav',
      sampleRate,
      channels,
      bitDepth,
      encoding,
      littleEndian: true,
      unsigned8: bitDepth === 8,
      dataLength: null
    };
  }

  private parseAiffComm(body: Buffer): void {
    if (body.length < 18) throw new Error('Malformed COMM chunk');
    const channels = body.readInt16BE(0);
    this.aiffFrames = body.readUInt32BE(2);
    const bitDepth = body.readInt16BE(6);
    const sampleRate = Math.round(readExtendedFloat80(body, 8));

    if (body.length >= 22) {
      this.aiffCompression = fourCC(body, 18).toUpperCase();
    }
    const comp = this.aiffCompression;
    let encoding: PcmEncoding = 'int';
    let littleEndian = false;
    if (comp === 'SOWT') littleEndian = true;
    else if (comp === 'FL32' || comp === 'FL64') encoding = 'float';
    else if (comp !== 'NONE' && comp !== 'TWOS') {
      throw new Error(`Compressed AIFF (${comp.trim()}) is not supported`);
    }

    if (![8, 16, 24, 32, 64].includes(bitDepth)) {
      throw new Error(`Unsupported AIFF bit depth ${bitDepth}`);
    }
    if (!channels || !sampleRate) throw new Error('Invalid AIFF header');

    this.format = {
      container: 'aiff',
      sampleRate,
      channels,
      bitDepth,
      encoding,
      littleEndian,
      unsigned8: false,
      dataLength: null
    };
  }

  /** Finalise after the stream ends. */
  finish(): WaveformPeaksResult {
    if (!this.format || !this.accumulator) {
      throw new Error('No PCM audio data found');
    }
    const frames = this.accumulator.framesSeen;
    return {
      version: WAVEFORM_VERSION,
      peaks: this.accumulator.toPeaks(),
      sampleRate: this.format.sampleRate,
      channels: this.format.channels,
      durationMs: Math.round((frames / this.format.sampleRate) * 1000),
      frames
    };
  }
}

/** Frames per fine-grained window when the total length is not known upfront. */
const FINE_WINDOW_FRAMES = 1024;

/**
 * Collects fine-grained window maxima from decoded channel data whose total
 * length is unknown in advance (streaming decode of MP3/FLAC), then resamples
 * to a fixed bucket count at the end.
 */
export class StreamingPeakCollector {
  private readonly fine: number[] = [];
  private windowMax = 0;
  private windowFill = 0;
  private frames = 0;
  private sampleRate = 0;
  private channels = 0;

  constructor(private readonly bucketCount = DEFAULT_WAVEFORM_BUCKETS) {}

  push(channelData: Float32Array[], sampleRate: number): void {
    const n = channelData[0]?.length ?? 0;
    if (!n) return;
    if (!this.sampleRate) this.sampleRate = sampleRate;
    if (!this.channels) this.channels = channelData.length;

    for (let f = 0; f < n; f++) {
      let peak = 0;
      for (const ch of channelData) {
        const v = Math.abs(ch[f]);
        if (v > peak) peak = v;
      }
      if (peak > this.windowMax) this.windowMax = peak;
      this.windowFill += 1;
      if (this.windowFill === FINE_WINDOW_FRAMES) {
        this.fine.push(this.windowMax);
        this.windowMax = 0;
        this.windowFill = 0;
      }
    }
    this.frames += n;
  }

  finish(): WaveformPeaksResult {
    if (this.windowFill > 0) {
      this.fine.push(this.windowMax);
      this.windowMax = 0;
      this.windowFill = 0;
    }
    const peaks = resamplePeaks(this.fine, this.bucketCount);
    return {
      version: WAVEFORM_VERSION,
      peaks,
      sampleRate: this.sampleRate,
      channels: this.channels,
      durationMs: this.sampleRate > 0 ? Math.round((this.frames / this.sampleRate) * 1000) : 0,
      frames: this.frames
    };
  }
}

/** Resample arbitrary-length maxima into `bucketCount` normalised 0–255 values. */
export function resamplePeaks(source: number[], bucketCount: number): number[] {
  const out = new Array<number>(bucketCount).fill(0);
  if (source.length === 0) return out;
  let maxSeen = 0;
  for (let b = 0; b < bucketCount; b++) {
    const start = Math.floor((b / bucketCount) * source.length);
    const end = Math.max(start + 1, Math.floor(((b + 1) / bucketCount) * source.length));
    let m = 0;
    for (let i = start; i < end && i < source.length; i++) {
      if (source[i] > m) m = source[i];
    }
    out[b] = m;
    if (m > maxSeen) maxSeen = m;
  }
  const scale = maxSeen > 0 ? 255 / maxSeen : 0;
  for (let b = 0; b < bucketCount; b++) out[b] = Math.round(out[b] * scale);
  return out;
}
