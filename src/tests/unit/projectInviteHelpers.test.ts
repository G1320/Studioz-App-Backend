/**
 * Invite lifecycle helpers (pure) — complements projectAccessService matrix tests.
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

describe('collaborator invite helpers', () => {
  it('normalizes emails for matching', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('hashes invite tokens deterministically', () => {
    const a = hashToken('abc');
    const b = hashToken('abc');
    const c = hashToken('abd');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });

  it('rejects email mismatch for accept', () => {
    const inviteEmail = normalizeEmail('artist@studioz.online');
    const userEmail = normalizeEmail('other@studioz.online');
    expect(inviteEmail === userEmail).toBe(false);
  });
});
