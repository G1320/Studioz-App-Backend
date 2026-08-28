import { describe, it, expect } from 'vitest';
import {
  assertProjectAccess,
  resolveProjectAccess,
  getProjectParticipantIds,
  oppositeSenderRoles,
  COLLABORATOR_CAP_PER_SIDE
} from '../../services/projectAccessService.js';

const baseProject = {
  customerId: 'cust1',
  vendorId: 'vend1',
  collaborators: [
    {
      userId: 'collab-c',
      side: 'customer' as const,
      status: 'active' as const
    },
    {
      userId: 'collab-v',
      side: 'vendor' as const,
      status: 'active' as const
    },
    {
      userId: 'removed',
      side: 'customer' as const,
      status: 'removed' as const
    }
  ]
};

describe('projectAccessService', () => {
  it('gives payer-only payment to primary customer', () => {
    const access = resolveProjectAccess(baseProject, 'cust1');
    expect(access.canPay).toBe(true);
    expect(access.canInvite).toBe(true);
    expect(access.canCustomerWorkflow).toBe(true);
    expect(access.canVendorWorkflow).toBe(false);
  });

  it('gives vendor workflow and invite to primary vendor', () => {
    const access = resolveProjectAccess(baseProject, 'vend1');
    expect(access.canVendorWorkflow).toBe(true);
    expect(access.canInvite).toBe(true);
    expect(access.canPay).toBe(false);
    expect(access.canUpdateMetadata).toBe(true);
  });

  it('gives customer-side collaborator workflow without pay/invite', () => {
    const access = resolveProjectAccess(baseProject, 'collab-c');
    expect(access.isCollaborator).toBe(true);
    expect(access.side).toBe('customer');
    expect(access.canCustomerWorkflow).toBe(true);
    expect(access.canPay).toBe(false);
    expect(access.canInvite).toBe(false);
    expect(access.senderRole).toBe('customer_collaborator');
  });

  it('gives vendor-side collaborator workflow and metadata', () => {
    const access = assertProjectAccess(baseProject, 'collab-v', 'vendor_workflow');
    expect(access.canUpdateMetadata).toBe(true);
    expect(access.canPay).toBe(false);
    expect(() => assertProjectAccess(baseProject, 'collab-v', 'pay')).toThrow();
  });

  it('forbids strangers and removed collaborators', () => {
    expect(() => resolveProjectAccess(baseProject, 'stranger')).toThrow();
    expect(() => resolveProjectAccess(baseProject, 'removed')).toThrow();
  });

  it('includes active collaborators in participant ids', () => {
    const ids = getProjectParticipantIds(baseProject);
    expect(ids.sort()).toEqual(['collab-c', 'collab-v', 'cust1', 'vend1'].sort());
  });

  it('maps opposite roles for unread', () => {
    expect(oppositeSenderRoles('customer')).toEqual(['vendor', 'vendor_collaborator']);
    expect(oppositeSenderRoles('vendor')).toEqual(['customer', 'customer_collaborator']);
  });

  it('exposes collaborator cap', () => {
    expect(COLLABORATOR_CAP_PER_SIDE).toBe(10);
  });
});
