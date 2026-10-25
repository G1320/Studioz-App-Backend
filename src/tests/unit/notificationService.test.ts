import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { NotificationModel } from '../../models/notificationModel.js';
import {
  archiveAllRead,
  archiveNotification,
  createNotification,
  deleteNotification,
  getUnreadCount,
  getUserNotifications,
  markAsRead,
  restoreNotification
} from '../../services/notificationService.js';
import { NotificationCleanupScheduler } from '../../workers/notificationCleanupScheduler.js';

describe('notification archive service', () => {
  let mongoServer: MongoMemoryServer;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    userId = new mongoose.Types.ObjectId().toString();
    otherUserId = new mongoose.Types.ObjectId().toString();
  });

  afterEach(async () => {
    await NotificationModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  const seed = async (overrides: Record<string, unknown> = {}) => {
    return createNotification({
      userId,
      type: 'system_alert',
      title: 'Test',
      message: 'Test message',
      ...overrides
    });
  };

  it('lists only active notifications by default and archived when requested', async () => {
    const active = await seed({ title: 'Active' });
    const archived = await seed({ title: 'Archived' });
    await archiveNotification(archived._id.toString(), userId);

    const activeList = await getUserNotifications(userId);
    expect(activeList.map((n) => n._id.toString())).toEqual([active._id.toString()]);

    const archivedList = await getUserNotifications(userId, { archived: true });
    expect(archivedList).toHaveLength(1);
    expect(archivedList[0]._id.toString()).toBe(archived._id.toString());
    expect(archivedList[0].archivedAt).toBeTruthy();
  });

  it('excludes archived notifications from unread count', async () => {
    const unread = await seed({ title: 'Unread' });
    await seed({ title: 'Also unread' });
    await archiveNotification(unread._id.toString(), userId);

    expect(await getUnreadCount(userId)).toBe(1);
  });

  it('archives a single notification and clears expiresAt', async () => {
    const notification = await createNotification({
      userId,
      type: 'system_alert',
      title: 'Expiring',
      message: 'Will archive',
      expiresAt: new Date(Date.now() + 60_000)
    });

    const archived = await archiveNotification(notification._id.toString(), userId);
    expect(archived?.archivedAt).toBeTruthy();
    expect(archived?.expiresAt).toBeUndefined();

    const stored = await NotificationModel.findById(notification._id).lean();
    expect(stored?.archivedAt).toBeTruthy();
    expect(stored?.expiresAt).toBeUndefined();
  });

  it('archives all read active notifications only', async () => {
    const readOne = await seed({ title: 'Read 1' });
    const readTwo = await seed({ title: 'Read 2' });
    const unread = await seed({ title: 'Unread' });
    await markAsRead(readOne._id.toString(), userId);
    await markAsRead(readTwo._id.toString(), userId);

    const result = await archiveAllRead(userId);
    expect(result.archivedCount).toBe(2);

    const active = await getUserNotifications(userId);
    expect(active).toHaveLength(1);
    expect(active[0]._id.toString()).toBe(unread._id.toString());

    const archived = await getUserNotifications(userId, { archived: true });
    expect(archived).toHaveLength(2);
  });

  it('restores an archived notification back to active', async () => {
    const notification = await seed({ title: 'To restore' });
    await archiveNotification(notification._id.toString(), userId);

    const restored = await restoreNotification(notification._id.toString(), userId);
    expect(restored?.archivedAt).toBeNull();

    const active = await getUserNotifications(userId);
    expect(active).toHaveLength(1);
    expect(active[0]._id.toString()).toBe(notification._id.toString());
  });

  it('only permanently deletes archived notifications owned by the user', async () => {
    const ownActive = await seed({ title: 'Own active' });
    const ownArchived = await seed({ title: 'Own archived' });
    await archiveNotification(ownArchived._id.toString(), userId);

    const other = await createNotification({
      userId: otherUserId,
      type: 'system_alert',
      title: 'Other',
      message: 'Other message'
    });
    await archiveNotification(other._id.toString(), otherUserId);

    expect(await deleteNotification(ownActive._id.toString(), userId)).toBe(false);
    expect(await deleteNotification(other._id.toString(), userId)).toBe(false);
    expect(await deleteNotification(ownArchived._id.toString(), userId)).toBe(true);

    expect(await NotificationModel.findById(ownArchived._id)).toBeNull();
    expect(await NotificationModel.findById(ownActive._id)).not.toBeNull();
    expect(await NotificationModel.findById(other._id)).not.toBeNull();
  });

  it('cleanup deletes old active notifications but keeps archived ones', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 100);

    const oldActive = await NotificationModel.create({
      userId,
      type: 'system_alert',
      category: 'system',
      title: 'Old active',
      message: 'Should delete',
      read: true,
      priority: 'medium',
      createdAt: oldDate,
      updatedAt: oldDate
    });

    const oldArchived = await NotificationModel.create({
      userId,
      type: 'system_alert',
      category: 'system',
      title: 'Old archived',
      message: 'Should keep',
      read: true,
      priority: 'medium',
      archivedAt: oldDate,
      createdAt: oldDate,
      updatedAt: oldDate
    });

    const scheduler = new NotificationCleanupScheduler();
    const deletedCount = await scheduler.runNow();
    scheduler.stop();

    expect(deletedCount).toBe(1);
    expect(await NotificationModel.findById(oldActive._id)).toBeNull();
    expect(await NotificationModel.findById(oldArchived._id)).not.toBeNull();
  });
});
