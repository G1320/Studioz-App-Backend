import ExpressError from '../utils/expressError.js';
import { SHARE_LINK_MAX_EXPIRY_DAYS } from '../constants/projectPermissions.js';
import { SHARE_PASSWORD_MAX_LENGTH, SHARE_PASSWORD_MIN_LENGTH } from './shareLinkSecurityService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Shortest expiry a sender can pick; shorter links would die before the recipient opens them. */
export const SHARE_LINK_MIN_EXPIRY_MS = 60 * 60 * 1000;
export const SHARE_LINK_MAX_JOINS = 1000;
export const SHARE_GUEST_NAME_MAX_LENGTH = 60;
export const SHARE_GUEST_MESSAGE_MAX_LENGTH = 2000;

/**
 * `undefined` = leave unchanged, `null` = clear (never expires / no password / unlimited joins).
 */
export interface ShareLinkSettings {
  label?: string | null;
  expiresAt?: Date | null;
  password?: string | null;
  maxJoins?: number | null;
}

export type ShareLinkStatus = 'active' | 'paused' | 'expired' | 'used' | 'revoked';

export function parseShareLinkSettings(body: Record<string, unknown>, nowMs = Date.now()): ShareLinkSettings {
  const settings: ShareLinkSettings = {};

  if (body.label !== undefined) {
    if (body.label === null) settings.label = null;
    else if (typeof body.label === 'string') settings.label = body.label.trim().slice(0, 80) || null;
    else throw new ExpressError('label must be a string', 400);
  }

  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === '') {
      settings.expiresAt = null;
    } else {
      const date = new Date(String(body.expiresAt));
      if (Number.isNaN(date.getTime())) throw new ExpressError('expiresAt must be a valid date', 400);
      settings.expiresAt = date;
    }
  } else if (body.expiresInDays !== undefined && body.expiresInDays !== null) {
    const days = Number(body.expiresInDays);
    if (!Number.isFinite(days) || days <= 0) {
      throw new ExpressError(`expiresInDays must be between 1 and ${SHARE_LINK_MAX_EXPIRY_DAYS}`, 400);
    }
    settings.expiresAt = new Date(nowMs + days * DAY_MS);
  }
  if (settings.expiresAt) {
    const delta = settings.expiresAt.getTime() - nowMs;
    if (delta < SHARE_LINK_MIN_EXPIRY_MS) {
      throw new ExpressError('Expiry must be at least one hour from now', 400);
    }
    if (delta > SHARE_LINK_MAX_EXPIRY_DAYS * DAY_MS) {
      throw new ExpressError(`Expiry can be at most ${SHARE_LINK_MAX_EXPIRY_DAYS} days from now`, 400);
    }
  }

  if (body.password !== undefined) {
    if (body.password === null || body.password === '') {
      settings.password = null;
    } else if (typeof body.password !== 'string') {
      throw new ExpressError('password must be a string', 400);
    } else if (
      body.password.length < SHARE_PASSWORD_MIN_LENGTH ||
      body.password.length > SHARE_PASSWORD_MAX_LENGTH
    ) {
      throw new ExpressError(
        `Password must be ${SHARE_PASSWORD_MIN_LENGTH}-${SHARE_PASSWORD_MAX_LENGTH} characters`,
        400
      );
    } else {
      settings.password = body.password;
    }
  }

  if (body.maxJoins !== undefined) {
    if (body.maxJoins === null || body.maxJoins === 0) {
      settings.maxJoins = null;
    } else {
      const max = Number(body.maxJoins);
      if (!Number.isInteger(max) || max < 1 || max > SHARE_LINK_MAX_JOINS) {
        throw new ExpressError(`maxJoins must be between 1 and ${SHARE_LINK_MAX_JOINS}`, 400);
      }
      settings.maxJoins = max;
    }
  }

  return settings;
}

export function shareLinkStatus(
  link: {
    revokedAt?: Date | null;
    disabledAt?: Date | null;
    expiresAt?: Date | null;
    maxJoins?: number | null;
    joinCount?: number | null;
  },
  nowMs = Date.now()
): ShareLinkStatus {
  if (link.revokedAt) return 'revoked';
  if (link.expiresAt && link.expiresAt.getTime() <= nowMs) return 'expired';
  if (link.maxJoins && (link.joinCount ?? 0) >= link.maxJoins) return 'used';
  if (link.disabledAt) return 'paused';
  return 'active';
}

export function parseGuestName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!name) throw new ExpressError('Please enter your name', 400);
  if (name.length > SHARE_GUEST_NAME_MAX_LENGTH) {
    throw new ExpressError(`Name must be at most ${SHARE_GUEST_NAME_MAX_LENGTH} characters`, 400);
  }
  return name;
}
