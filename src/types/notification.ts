export type NotificationType =
  // Bookings
  | 'new_reservation'
  | 'reservation_confirmed'
  | 'reservation_cancelled'
  | 'reservation_expired'
  | 'reservation_modified'
  | 'reservation_reminder'
  // Payments
  | 'payout_completed'
  | 'payout_failed'
  // Reviews
  | 'new_review'
  // Billing
  | 'subscription_trial_ending'
  | 'subscription_payment_failed'
  | 'subscription_renewed'
  // System
  | 'calendar_sync_error'
  | 'platform_announcement'
  | 'weekly_summary'
  // Activity
  | 'customer_message'
  | 'availability_alert'
  // Legacy (kept for backwards compatibility)
  | 'system_alert';

export type NotificationCategory =
  | 'bookings'
  | 'payments'
  | 'reviews'
  | 'billing'
  | 'system'
  | 'activity';

export type NotificationPriority = 'low' | 'medium' | 'high';

export const NOTIFICATION_TYPE_CATEGORY: Record<NotificationType, NotificationCategory> = {
  new_reservation: 'bookings',
  reservation_confirmed: 'bookings',
  reservation_cancelled: 'bookings',
  reservation_expired: 'bookings',
  reservation_modified: 'bookings',
  reservation_reminder: 'bookings',
  payout_completed: 'payments',
  payout_failed: 'payments',
  new_review: 'reviews',
  subscription_trial_ending: 'billing',
  subscription_payment_failed: 'billing',
  subscription_renewed: 'billing',
  calendar_sync_error: 'system',
  platform_announcement: 'system',
  weekly_summary: 'system',
  customer_message: 'activity',
  availability_alert: 'activity',
  system_alert: 'system',
};

export const NOTIFICATION_TYPE_PRIORITY: Partial<Record<NotificationType, NotificationPriority>> = {
  new_reservation: 'high',
  reservation_confirmed: 'high',
  payout_failed: 'high',
  subscription_payment_failed: 'high',
  calendar_sync_error: 'high',
  weekly_summary: 'low',
  platform_announcement: 'low',
  availability_alert: 'low',
};

export default interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  data?: {
    reservationId?: string;
    itemId?: string;
    studioId?: string;
    [key: string]: any;
  };
  read: boolean;
  readAt?: Date;
  priority: NotificationPriority;
  actionUrl?: string;
  expiresAt?: Date;
  groupKey?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

