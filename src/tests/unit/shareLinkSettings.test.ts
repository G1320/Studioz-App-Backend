import { describe, expect, it } from 'vitest';
import {
  createShareAccessKey,
  hashSharePassword,
  verifyShareAccessKey,
  verifySharePassword
} from '../../services/shareLinkSecurityService.js';
import {
  parseGuestName,
  parseShareLinkSettings,
  shareLinkStatus
} from '../../services/shareLinkSettingsService.js';

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('share link passwords', () => {
  it('verifies the right password and rejects others', () => {
    const hash = hashSharePassword('open sesame');
    expect(hash).not.toContain('open sesame');
    expect(verifySharePassword('open sesame', hash)).toBe(true);
    expect(verifySharePassword('open sesame!', hash)).toBe(false);
    expect(verifySharePassword('open sesame', undefined)).toBe(false);
  });

  it('salts each hash', () => {
    expect(hashSharePassword('same')).not.toBe(hashSharePassword('same'));
  });
});

describe('share link access keys', () => {
  const hash = hashSharePassword('pw12');

  it('accepts a fresh key for the same link and password', () => {
    const { accessKey } = createShareAccessKey('link1', hash, NOW);
    expect(verifyShareAccessKey('link1', hash, accessKey, NOW + HOUR)).toBe(true);
  });

  it('rejects keys for another link, after expiry, or after the password changes', () => {
    const { accessKey, expiresIn } = createShareAccessKey('link1', hash, NOW);
    expect(verifyShareAccessKey('link2', hash, accessKey, NOW)).toBe(false);
    expect(verifyShareAccessKey('link1', hash, accessKey, NOW + expiresIn * 1000 + 1)).toBe(false);
    expect(verifyShareAccessKey('link1', hashSharePassword('pw12'), accessKey, NOW)).toBe(false);
  });

  it('rejects tampered or malformed keys', () => {
    const { accessKey } = createShareAccessKey('link1', hash, NOW);
    const [exp, sig] = accessKey.split('.');
    expect(verifyShareAccessKey('link1', hash, `${Number(exp) + 999999}.${sig}`, NOW)).toBe(false);
    expect(verifyShareAccessKey('link1', hash, 'garbage', NOW)).toBe(false);
    expect(verifyShareAccessKey('link1', hash, undefined, NOW)).toBe(false);
  });
});

describe('share link settings', () => {
  it('accepts an exact expiry date chosen by the sender', () => {
    const at = new Date(NOW + 3 * DAY + 5 * HOUR);
    expect(parseShareLinkSettings({ expiresAt: at.toISOString() }, NOW).expiresAt).toEqual(at);
  });

  it('keeps supporting day presets and "never"', () => {
    expect(parseShareLinkSettings({ expiresInDays: 7 }, NOW).expiresAt).toEqual(new Date(NOW + 7 * DAY));
    expect(parseShareLinkSettings({ expiresAt: null }, NOW).expiresAt).toBeNull();
    expect(parseShareLinkSettings({}, NOW).expiresAt).toBeUndefined();
  });

  it('rejects expiries in the past, under an hour, or over a year', () => {
    expect(() => parseShareLinkSettings({ expiresAt: new Date(NOW - HOUR).toISOString() }, NOW)).toThrow();
    expect(() => parseShareLinkSettings({ expiresAt: new Date(NOW + 30 * 60 * 1000).toISOString() }, NOW)).toThrow();
    expect(() => parseShareLinkSettings({ expiresAt: new Date(NOW + 400 * DAY).toISOString() }, NOW)).toThrow();
    expect(() => parseShareLinkSettings({ expiresAt: 'not a date' }, NOW)).toThrow();
  });

  it('validates passwords and single-use limits', () => {
    expect(parseShareLinkSettings({ password: 'abcd' }, NOW).password).toBe('abcd');
    expect(parseShareLinkSettings({ password: '' }, NOW).password).toBeNull();
    expect(() => parseShareLinkSettings({ password: 'abc' }, NOW)).toThrow();
    expect(parseShareLinkSettings({ maxJoins: 1 }, NOW).maxJoins).toBe(1);
    expect(parseShareLinkSettings({ maxJoins: null }, NOW).maxJoins).toBeNull();
    expect(() => parseShareLinkSettings({ maxJoins: 0.5 }, NOW)).toThrow();
  });
});

describe('share link status', () => {
  it('reports the most permanent reason a link is unusable', () => {
    expect(shareLinkStatus({}, NOW)).toBe('active');
    expect(shareLinkStatus({ disabledAt: new Date(NOW) }, NOW)).toBe('paused');
    expect(shareLinkStatus({ maxJoins: 1, joinCount: 1 }, NOW)).toBe('used');
    expect(shareLinkStatus({ maxJoins: 2, joinCount: 1 }, NOW)).toBe('active');
    expect(shareLinkStatus({ expiresAt: new Date(NOW - 1), disabledAt: new Date(NOW) }, NOW)).toBe('expired');
    expect(shareLinkStatus({ revokedAt: new Date(NOW), expiresAt: new Date(NOW - 1) }, NOW)).toBe('revoked');
  });
});

describe('guest names', () => {
  it('trims and collapses whitespace, and requires a name', () => {
    expect(parseGuestName('  Dana   Levi ')).toBe('Dana Levi');
    expect(() => parseGuestName('   ')).toThrow();
    expect(() => parseGuestName('x'.repeat(61))).toThrow();
  });
});
