import { describe, it, expect } from 'vitest';
import { PcmStreamAnalyzer, StreamingPeakCollector, resamplePeaks } from '../../services/waveform/pcmPeaks.js';

/** Build a 16-bit PCM WAV with an optional oversized metadata chunk before `data`. */
function buildWav(opts: {
  sampleRate?: number;
  channels?: number;
  bitDepth?: 16 | 24 | 32;
  float?: boolean;
  frames: (frame: number) => number[];
  frameCount: number;
  junkChunkBytes?: number;
}): Buffer {
  const sampleRate = opts.sampleRate ?? 44100;
  const channels = opts.channels ?? 1;
  const bitDepth = opts.bitDepth ?? 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = bytesPerSample * channels;
  const dataLength = opts.frameCount * blockAlign;

  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(opts.float ? 3 : 1, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate * blockAlign, 8);
  fmt.writeUInt16LE(blockAlign, 12);
  fmt.writeUInt16LE(bitDepth, 14);

  const data = Buffer.alloc(dataLength);
  let off = 0;
  for (let f = 0; f < opts.frameCount; f++) {
    const samples = opts.frames(f);
    for (let c = 0; c < channels; c++) {
      const v = samples[c] ?? 0;
      if (opts.float) {
        data.writeFloatLE(v, off);
      } else if (bitDepth === 16) {
        data.writeInt16LE(Math.round(v * 32767), off);
      } else if (bitDepth === 24) {
        const i = Math.round(v * 8388607);
        data.writeIntLE(i, off, 3);
      } else {
        data.writeInt32LE(Math.round(v * 2147483647), off);
      }
      off += bytesPerSample;
    }
  }

  const chunks: Buffer[] = [];
  const chunk = (id: string, body: Buffer) => {
    const header = Buffer.alloc(8);
    header.write(id, 0, 'latin1');
    header.writeUInt32LE(body.length, 4);
    chunks.push(header, body);
    if (body.length % 2) chunks.push(Buffer.alloc(1));
  };

  chunk('fmt ', fmt);
  if (opts.junkChunkBytes) chunk('LIST', Buffer.alloc(opts.junkChunkBytes, 0x41));
  chunk('data', data);

  const body = Buffer.concat(chunks);
  const riff = Buffer.alloc(12);
  riff.write('RIFF', 0, 'latin1');
  riff.writeUInt32LE(4 + body.length, 4);
  riff.write('WAVE', 8, 'latin1');
  return Buffer.concat([riff, body]);
}

/** Build a big-endian 16-bit AIFF. */
function buildAiff(frameCount: number, sample: (f: number) => number): Buffer {
  const channels = 1;
  const sampleRate = 48000;
  const comm = Buffer.alloc(18);
  comm.writeInt16BE(channels, 0);
  comm.writeUInt32BE(frameCount, 2);
  comm.writeInt16BE(16, 6);
  // 48000 as 80-bit extended: exponent 16383+15, mantissa 48000 << (63-15)
  comm.writeUInt16BE(16383 + 15, 8);
  const mant = BigInt(48000) << BigInt(63 - 15);
  comm.writeUInt32BE(Number(mant >> 32n), 10);
  comm.writeUInt32BE(Number(mant & 0xffffffffn), 14);

  const pcm = Buffer.alloc(frameCount * 2);
  for (let f = 0; f < frameCount; f++) pcm.writeInt16BE(Math.round(sample(f) * 32767), f * 2);
  const ssnd = Buffer.concat([Buffer.alloc(8), pcm]);

  const chunk = (id: string, body: Buffer) => {
    const header = Buffer.alloc(8);
    header.write(id, 0, 'latin1');
    header.writeUInt32BE(body.length, 4);
    return Buffer.concat([header, body]);
  };
  const body = Buffer.concat([chunk('COMM', comm), chunk('SSND', ssnd)]);
  const form = Buffer.alloc(12);
  form.write('FORM', 0, 'latin1');
  form.writeUInt32BE(4 + body.length, 4);
  form.write('AIFF', 8, 'latin1');
  void sampleRate;
  return Buffer.concat([form, body]);
}

function feed(analyzer: PcmStreamAnalyzer, buf: Buffer, chunkSize: number) {
  for (let i = 0; i < buf.length; i += chunkSize) {
    analyzer.push(buf.subarray(i, Math.min(buf.length, i + chunkSize)));
  }
  return analyzer.finish();
}

describe('PcmStreamAnalyzer', () => {
  it('extracts peaks from a 16-bit WAV regardless of chunk boundaries', () => {
    const frameCount = 10_000;
    // Quiet first half, loud second half
    const wav = buildWav({ frameCount, frames: (f) => [f < frameCount / 2 ? 0.1 : 0.9] });

    for (const chunkSize of [7, 64, 1000, wav.length]) {
      const result = feed(new PcmStreamAnalyzer(wav.length, 10), wav, chunkSize);
      expect(result.frames).toBe(frameCount);
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(1);
      expect(result.peaks).toHaveLength(10);
      // Normalised: loud half hits 255, quiet half ≈ 28 (0.1/0.9 * 255)
      expect(result.peaks.slice(5)).toEqual([255, 255, 255, 255, 255]);
      for (const p of result.peaks.slice(0, 5)) expect(Math.abs(p - 28)).toBeLessThanOrEqual(1);
    }
  });

  it('skips oversized metadata chunks before data', () => {
    const wav = buildWav({ frameCount: 2000, frames: () => [0.5], junkChunkBytes: 300_000 });
    const result = feed(new PcmStreamAnalyzer(wav.length, 4), wav, 4096);
    expect(result.frames).toBe(2000);
    expect(result.peaks).toEqual([255, 255, 255, 255]);
  });

  it('handles 24-bit stereo and reduces channels by max', () => {
    const wav = buildWav({
      frameCount: 4000,
      channels: 2,
      bitDepth: 24,
      frames: (f) => (f < 2000 ? [0.2, 0.8] : [0.8, 0.2])
    });
    const result = feed(new PcmStreamAnalyzer(wav.length, 2), wav, 333);
    expect(result.channels).toBe(2);
    expect(result.peaks).toEqual([255, 255]);
  });

  it('handles 32-bit float WAV', () => {
    const wav = buildWav({ frameCount: 3000, bitDepth: 32, float: true, frames: (f) => [f < 1500 ? 0.25 : 1] });
    const result = feed(new PcmStreamAnalyzer(wav.length, 2), wav, 512);
    expect(result.peaks[1]).toBe(255);
    expect(Math.abs(result.peaks[0] - 64)).toBeLessThanOrEqual(1);
  });

  it('parses big-endian AIFF', () => {
    const aiff = buildAiff(6000, (f) => (f < 3000 ? 0.5 : 1));
    const result = feed(new PcmStreamAnalyzer(aiff.length, 2), aiff, 1000);
    expect(result.sampleRate).toBe(48000);
    expect(result.frames).toBe(6000);
    expect(result.peaks).toEqual([128, 255]);
  });

  it('rejects non-PCM containers', () => {
    const analyzer = new PcmStreamAnalyzer(100, 10);
    expect(() => analyzer.push(Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00abcd', 'latin1'))).toThrow(
      /Not a WAV or AIFF/
    );
  });

  it('returns a flat waveform for digital silence', () => {
    const wav = buildWav({ frameCount: 1000, frames: () => [0] });
    const result = feed(new PcmStreamAnalyzer(wav.length, 5), wav, 100);
    expect(result.peaks).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('StreamingPeakCollector', () => {
  it('resamples arbitrary-length decoded chunks into fixed buckets', () => {
    const collector = new StreamingPeakCollector(4);
    const quiet = new Float32Array(4096).fill(0.25);
    const loud = new Float32Array(4096).fill(1);
    collector.push([quiet, quiet], 44100);
    collector.push([loud, loud], 44100);
    const result = collector.finish();
    expect(result.frames).toBe(8192);
    expect(result.channels).toBe(2);
    expect(result.peaks).toEqual([64, 64, 255, 255]);
    expect(result.durationMs).toBe(Math.round((8192 / 44100) * 1000));
  });
});

describe('resamplePeaks', () => {
  it('normalises to 0–255 and handles empty input', () => {
    expect(resamplePeaks([], 3)).toEqual([0, 0, 0]);
    expect(resamplePeaks([0.5, 0.5, 1, 1], 2)).toEqual([128, 255]);
  });
});
