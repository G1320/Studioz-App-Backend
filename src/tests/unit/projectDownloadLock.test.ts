import { describe, it, expect } from 'vitest';
import { canDownloadProjectFile, isDeliverableDownloadLocked } from '../../services/projectAccessService.js';

describe('deliverable download lock', () => {
  it('is inactive when the vendor never enabled it', () => {
    expect(isDeliverableDownloadLocked({ status: 'delivered' })).toBe(false);
    expect(isDeliverableDownloadLocked({ status: 'delivered', downloadLock: { enabled: false } })).toBe(false);
  });

  it('locks deliverables while enabled and not yet approved or paid', () => {
    const project = { status: 'delivered', paymentStatus: 'deposit_paid', downloadLock: { enabled: true } };
    expect(isDeliverableDownloadLocked(project)).toBe(true);
  });

  it('unlocks on completion (approval), full payment, or manual release', () => {
    expect(isDeliverableDownloadLocked({ status: 'completed', downloadLock: { enabled: true } })).toBe(false);
    expect(
      isDeliverableDownloadLocked({
        status: 'delivered',
        paymentStatus: 'fully_paid',
        downloadLock: { enabled: true }
      })
    ).toBe(false);
    expect(
      isDeliverableDownloadLocked({
        status: 'delivered',
        downloadLock: { enabled: true, releasedAt: new Date() }
      })
    ).toBe(false);
  });

  it('never blocks the vendor side or customer source uploads', () => {
    const locked = { status: 'delivered', downloadLock: { enabled: true } };
    expect(canDownloadProjectFile(locked, { side: 'vendor' }, 'deliverable')).toBe(true);
    expect(canDownloadProjectFile(locked, { side: 'customer' }, 'source')).toBe(true);
  });

  it('blocks customer-side deliverable and revision downloads while locked', () => {
    const locked = { status: 'delivered', downloadLock: { enabled: true } };
    expect(canDownloadProjectFile(locked, { side: 'customer' }, 'deliverable')).toBe(false);
    expect(canDownloadProjectFile(locked, { side: 'customer' }, 'revision')).toBe(false);
  });
});
