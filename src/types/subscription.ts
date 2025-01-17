
export interface Subscription {
    _id: string;
    userId: string;
    planId: string;
    planName: string;
    customerName: string;
    customerEmail: string;
    paypalSubscriptionId?: string;
    status: 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'PAYMENT_FAILED';
    startDate?: Date;
    endDate?: Date;
    createdAt: Date;
    updatedAt?: Date;
    paypalDetails?: any;
  }