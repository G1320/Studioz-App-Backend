import { describe, it, expect } from 'vitest';
import {
  ROLE_CAPABILITIES,
  capabilitiesRequireLogin,
  normalizeCapabilities,
  resolveGrantCapabilities,
  roleForCapabilities
} from '../../constants/projectPermissions.js';
import {
  assertProjectAccess,
  canDeleteProjectFile,
  getProjectParticipantIds,
  isFileInScope,
  resolveProjectAccess,
  uploadableFileTypesForSide
} from '../../services/projectAccessService.js';

const future = new Date(Date.now() + 60 * 60 * 1000);
const past = new Date(Date.now() - 60 * 1000);

const project = {
  customerId: 'cust1',
  vendorId: 'vend1',
  collaborators: [
    { userId: 'listener', side: 'customer' as const, status: 'active' as const, capabilities: ['listen', 'comment'] },
    {
      userId: 'downloader',
      side: 'customer' as const,
      status: 'active' as const,
      capabilities: [...ROLE_CAPABILITIES.listener_download]
    },
    {
      userId: 'contributor',
      side: 'vendor' as const,
      status: 'active' as const,
      capabilities: [...ROLE_CAPABILITIES.contributor]
    },
    {
      userId: 'cust-editor',
      side: 'customer' as const,
      status: 'active' as const,
      capabilities: [...ROLE_CAPABILITIES.editor]
    },
    {
      userId: 'scoped',
      side: 'customer' as const,
      status: 'active' as const,
      capabilities: ['listen'],
      fileIds: ['file-a']
    },
    {
      userId: 'expired',
      side: 'customer' as const,
      status: 'active' as const,
      capabilities: [...ROLE_CAPABILITIES.editor],
      expiresAt: past
    },
    {
      userId: 'expiring',
      side: 'customer' as const,
      status: 'active' as const,
      capabilities: ['listen'],
      expiresAt: future
    },
    { userId: 'legacy', side: 'vendor' as const, status: 'active' as const }
  ]
};

describe('project permission presets', () => {
  it('always includes listen and returns canonical order', () => {
    expect(normalizeCapabilities(['edit', 'download'])).toEqual(['listen', 'download', 'edit']);
    expect(normalizeCapabilities([])).toEqual(['listen']);
  });

  it('rejects unknown capabilities', () => {
    expect(() => normalizeCapabilities(['listen', 'admin'])).toThrow(/Unknown capability/);
  });

  it('resolves presets and explicit overrides', () => {
    expect(resolveGrantCapabilities('contributor', undefined)).toEqual(['listen', 'comment', 'download', 'upload']);
    expect(resolveGrantCapabilities('editor', ['download'])).toEqual(['listen', 'download']);
    expect(() => resolveGrantCapabilities('owner', undefined)).toThrow();
  });

  it('maps capability sets back to presets or custom', () => {
    expect(roleForCapabilities(['listen'])).toBe('listener');
    expect(roleForCapabilities(['listen', 'comment'])).toBe('reviewer');
    expect(roleForCapabilities(['download', 'listen'])).toBe('listener_download');
    expect(roleForCapabilities(['comment', 'download', 'listen'])).toBe('custom');
    expect(roleForCapabilities(['listen', 'upload'])).toBe('custom');
  });

  it('listen, comment and download links work anonymously; upload and edit need an account', () => {
    expect(capabilitiesRequireLogin(['listen'])).toBe(false);
    expect(capabilitiesRequireLogin(['listen', 'download'])).toBe(false);
    expect(capabilitiesRequireLogin(['listen', 'comment', 'download'])).toBe(false);
    expect(capabilitiesRequireLogin(['listen', 'download', 'upload'])).toBe(true);
    expect(capabilitiesRequireLogin(['listen', 'edit'])).toBe(true);
  });
});

describe('capability-based project access', () => {
  it('gives primaries every capability', () => {
    for (const id of ['cust1', 'vend1']) {
      const access = resolveProjectAccess(project, id);
      expect(access.role).toBe('owner');
      expect(access.canDownload && access.canUpload && access.canEdit && access.canChat).toBe(true);
      expect(access.fileScope).toBeNull();
    }
  });

  it('treats collaborators without stored capabilities as legacy editors', () => {
    const access = resolveProjectAccess(project, 'legacy');
    expect(access.role).toBe('editor');
    expect(access.canVendorWorkflow).toBe(true);
    expect(access.canUpdateMetadata).toBe(true);
  });

  it('reviewers can listen and comment but not download, upload, edit or run workflow', () => {
    const access = resolveProjectAccess(project, 'listener');
    expect(access.role).toBe('reviewer');
    expect(access.canFiles).toBe(true);
    expect(access.canChat).toBe(true);
    expect(access.canDownload || access.canUpload || access.canEdit).toBe(false);
    expect(access.canCustomerWorkflow).toBe(false);
    expect(() => assertProjectAccess(project, 'listener', 'download')).toThrow();
    expect(() => assertProjectAccess(project, 'listener', 'customer_workflow')).toThrow();
    expect(() => assertProjectAccess(project, 'listener', 'update_artwork')).toThrow();
  });

  it('download preset adds downloading only', () => {
    expect(assertProjectAccess(project, 'downloader', 'download').canDownload).toBe(true);
    expect(() => assertProjectAccess(project, 'downloader', 'upload')).toThrow();
  });

  it('contributors upload but cannot edit or run workflow', () => {
    expect(assertProjectAccess(project, 'contributor', 'upload').side).toBe('vendor');
    expect(() => assertProjectAccess(project, 'contributor', 'edit')).toThrow();
    expect(() => assertProjectAccess(project, 'contributor', 'vendor_workflow')).toThrow();
  });

  it('editors get their side’s workflow and can invite, but never pay', () => {
    const access = assertProjectAccess(project, 'cust-editor', 'customer_workflow');
    expect(access.canVendorWorkflow).toBe(false);
    expect(access.canPay).toBe(false);
    expect(access.canInvite).toBe(true);
  });

  it('expired collaborators lose access and stop receiving events', () => {
    expect(() => resolveProjectAccess(project, 'expired')).toThrow();
    expect(resolveProjectAccess(project, 'expiring').canFiles).toBe(true);
    const ids = getProjectParticipantIds(project);
    expect(ids).not.toContain('expired');
    expect(ids).toContain('expiring');
  });
});

describe('file scope and file actions', () => {
  it('scoped users see granted files plus their own uploads', () => {
    const access = resolveProjectAccess(project, 'scoped');
    expect(access.fileScope).toEqual(['file-a']);
    expect(isFileInScope(access, { _id: 'file-a' })).toBe(true);
    expect(isFileInScope(access, { _id: 'file-b', uploadedBy: 'vend1' })).toBe(false);
    expect(isFileInScope(access, { _id: 'file-c', uploadedBy: 'scoped' })).toBe(true);
  });

  it('editors delete any visible file; contributors only their own uploads', () => {
    const editor = resolveProjectAccess(project, 'cust-editor');
    const contributor = resolveProjectAccess(project, 'contributor');
    const listener = resolveProjectAccess(project, 'listener');
    const theirs = { _id: 'f1', uploadedBy: 'contributor' };
    const other = { _id: 'f2', uploadedBy: 'vend1' };

    expect(canDeleteProjectFile(editor, other)).toBe(true);
    expect(canDeleteProjectFile(contributor, theirs)).toBe(true);
    expect(canDeleteProjectFile(contributor, other)).toBe(false);
    expect(canDeleteProjectFile(listener, { _id: 'f3', uploadedBy: 'listener' })).toBe(false);
  });

  it('restricts upload file types by side', () => {
    expect(uploadableFileTypesForSide('customer')).toEqual(['source']);
    expect(uploadableFileTypesForSide('vendor')).toEqual(['deliverable', 'revision']);
  });
});
