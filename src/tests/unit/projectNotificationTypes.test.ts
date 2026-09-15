import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_TYPE_CATEGORY,
  type NotificationType
} from '../../types/notification.js';

describe('project message notification types', () => {
  it.each<NotificationType>([
    'project_chat_message',
    'project_track_comment',
    'project_comment_reply'
  ])('categorizes %s as a project notification', (type) => {
    expect(NOTIFICATION_TYPE_CATEGORY[type]).toBe('projects');
  });
});
