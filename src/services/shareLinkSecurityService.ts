import crypto from 'crypto';
import { JWT_SECRET_KEY } from '../config/index.js';

export const SHARE_PASSWORD_MIN_LENGTH = 4;
export const SHARE_PASSWORD_MAX_LENGTH = 128;
/** How long an unlocked password-protected link stays open in the listener's browser. */
export const SHARE_ACCESS_KEY_TTL_SECONDS = 12 * 60 * 60;

const SCRYPT_KEY_LENGTH = 32;

export function hashSharePassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifySharePassword(password: string, stored: string | undefined | null): boolean {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64url'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function secret(): string {
  if (!JWT_SECRET_KEY) throw new Error('JWT_SECRET_KEY is required to sign share link access keys');
  return JWT_SECRET_KEY;
}

/** The password hash is part of the signature, so changing or removing the password invalidates old keys. */
function sign(linkId: string, passwordHash: string, expiresAtSec: number): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`share-access:${linkId}:${expiresAtSec}:${passwordHash}`)
    .digest('base64url');
}

export function createShareAccessKey(
  linkId: string,
  passwordHash: string,
  nowMs = Date.now()
): { accessKey: string; expiresIn: number } {
  const expiresAtSec = Math.floor(nowMs / 1000) + SHARE_ACCESS_KEY_TTL_SECONDS;
  return {
    accessKey: `${expiresAtSec}.${sign(linkId, passwordHash, expiresAtSec)}`,
    expiresIn: SHARE_ACCESS_KEY_TTL_SECONDS
  };
}

export function verifyShareAccessKey(
  linkId: string,
  passwordHash: string,
  accessKey: unknown,
  nowMs = Date.now()
): boolean {
  if (typeof accessKey !== 'string' || accessKey.length > 200) return false;
  const [expPart, signature] = accessKey.split('.');
  const expiresAtSec = Number(expPart);
  if (!signature || !Number.isInteger(expiresAtSec) || expiresAtSec * 1000 <= nowMs) return false;
  const expected = Buffer.from(sign(linkId, passwordHash, expiresAtSec));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
