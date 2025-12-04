export type NotificationType = 
  | 'new_reservation'
  | 'reservation_confirmed'
  | 'reservation_cancelled'
  | 'reservation_expired'
  | 'reservation_modified'
  | 'reservation_reminder'
  | 'system_alert';

export type NotificationPriority = 'low' | 'medium' | 'high';

export default interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
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
  createdAt?: Date;
  updatedAt?: Date;
}

