import { Document, ObjectId } from 'mongoose';

interface SumitPaymentMethod {
  ID: string;
  CustomerID: string;
  CreditCard_LastDigits: string;
  CreditCard_ExpirationMonth: number;
  CreditCard_ExpirationYear: number;
  CreditCard_CitizenID: string;
  CreditCard_CardMask: string;
  CreditCard_Token: string;
  Type: number;
}

interface SumitPaymentDetails {
  ID: string;
  CustomerID: string;
  Date: Date;
  ValidPayment: boolean;
  Status: string;
  StatusDescription: string;
  Amount: number;
  Currency: number;
  PaymentMethod: SumitPaymentMethod;
  AuthNumber: string;
  FirstPaymentAmount: number;
  NonFirstPaymentAmount: number;
  RecurringCustomerItemIDs: string[];
}

export interface Subscription {
  _id: string;
  userId: ObjectId;
  planId: string;
  planName: string;
  customerName: string;
  customerEmail: string;
  sumitPaymentId: string;
  sumitCustomerId: string;
  sumitRecurringItemIds: string[];
  sumitPaymentDetails: SumitPaymentDetails;
  status: 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'PAYMENT_FAILED';
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  paypalDetails?: any;
}

export interface SubscriptionDocument extends Document, Omit<Subscription, '_id'> {}