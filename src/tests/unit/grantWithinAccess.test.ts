import { describe, expect, it } from 'vitest';
import { grantWithinAccess } from '../../services/projectGrantService.js';
import { resolveProjectAccess } from '../../services/projectAccessService.js';

const owner = { capabilities: ['listen', 'comment', 'download', 'upload', 'edit'], fileScope: null };
const scopedEditor = { capabilities: ['listen', 'comment', 'download', 'upload', 'edit'], fileScope: ['a', 'b'] };
const reviewer = { capabilities: ['listen', 'comment'], fileScope: null };

describe('grantWithinAccess', () => {
  it('lets owners give any grant', () => {
    expect(grantWithinAccess(owner as never, { capabilities: ['listen', 'edit'] })).toBe(true);
    expect(grantWithinAccess(owner as never, { capabilities: ['listen'], fileIds: ['x'] })).toBe(true);
  });

  it('rejects capabilities the giver does not have', () => {
    expect(grantWithinAccess(reviewer as never, { capabilities: ['listen', 'comment'] })).toBe(true);
    expect(grantWithinAccess(reviewer as never, { capabilities: ['listen', 'download'] })).toBe(false);
  });

  it('keeps scoped givers inside their files', () => {
    expect(grantWithinAccess(scopedEditor as never, { capabilities: ['listen'], fileIds: ['a'] })).toBe(true);
    expect(grantWithinAccess(scopedEditor as never, { capabilities: ['listen'], fileIds: ['a', 'c'] })).toBe(false);
    expect(grantWithinAccess(scopedEditor as never, { capabilities: ['listen'] })).toBe(false);
  });
});

describe('invite rights', () => {
  const project = {
    customerId: 'customer',
    vendorId: 'vendor',
    collaborators: [
      { userId: 'editor', side: 'vendor', status: 'active', capabilities: ['listen', 'comment', 'download', 'upload', 'edit'] },
      { userId: 'contributor', side: 'vendor', status: 'active', capabilities: ['listen', 'comment', 'download', 'upload'] }
    ]
  };

  it('lets owners and editors invite, but not other collaborators', () => {
    expect(resolveProjectAccess(project as never, 'vendor').canInvite).toBe(true);
    expect(resolveProjectAccess(project as never, 'editor').canInvite).toBe(true);
    expect(resolveProjectAccess(project as never, 'contributor').canInvite).toBe(false);
  });
});
