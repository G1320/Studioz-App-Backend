import { Document } from 'mongoose';

interface SumitPaymentMethod {
  ID: string;
  CustomerID: string | null;
  CreditCard_Number: string | null;
  CreditCard_LastDigits: string;
  CreditCard_ExpirationMonth: number;
  CreditCard_ExpirationYear: number;
  CreditCard_CVV: string | null;
  CreditCard_Track2: string | null;
  CreditCard_CitizenID: string;
  CreditCard_CardMask: string;
  CreditCard_Token: string;
  DirectDebit_Bank: string | null;
  DirectDebit_Branch: string | null;
  DirectDebit_Account: string | null;
  DirectDebit_ExpirationDate: string | null;
  DirectDebit_MaximumAmount: string | null;
  Type: number;
}

interface SumitPayment {
  ID: string;
  CustomerID: string;
  Date: string;
  ValidPayment: boolean;
  Status: string;
  StatusDescription: string;
  Amount: number;
  Currency: number;
  PaymentMethod: SumitPaymentMethod;
  AuthNumber: string;
  FirstPaymentAmount: number | null;
  NonFirstPaymentAmount: number | null;
  RecurringCustomerItemIDs: string[];
}

interface SumitPaymentDetails {
  Payment: SumitPayment;
  DocumentID: string;
  CustomerID: string;
  DocumentDownloadURL: string;
  RecurringCustomerItemIDs: string[];
}

export interface Subscription {
  _id: string;
  userId: string;
  planId: string;
  planName: string;
  customerName: string;
  customerEmail: string;
  sumitPaymentId: string;
  sumitCustomerId: string;
  sumitRecurringItemIds: string[];
  sumitPaymentDetails: SumitPaymentDetails;
  status: 'PENDING' | 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'PAYMENT_FAILED' | 'TRIAL' | 'TRIAL_ENDED';
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  paypalDetails?: any;
  // Trial fields
  isTrial?: boolean;
  trialEndDate?: Date;
  trialDurationDays?: number;
  trialChargeAttempts?: number;
  trialChargeFailedAt?: Date;
}

export interface SubscriptionDocument extends Document, Omit<Subscription, '_id'> {}