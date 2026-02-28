export type EmailTemplateName =
  | 'WELCOME'
  | 'PASSWORD_RESET'
  | 'EMAIL_VERIFICATION'
  | 'ACCOUNT_DEACTIVATION'
  | 'ORDER_CONFIRMATION'
  | 'PAYOUT_NOTIFICATION'
  | 'REFUND_CONFIRMATION'
  | 'ORDER_CANCELLED'
  | 'NEW_BOOKING_VENDOR'
  | 'BOOKING_CONFIRMED_CUSTOMER'
  | 'BOOKING_REMINDER'
  | 'BOOKING_CANCELLED_CUSTOMER'
  | 'BOOKING_CANCELLED_VENDOR'
  | 'BOOKING_MODIFIED'
  | 'REVIEW_REQUEST'
  | 'SUBSCRIPTION_CONFIRMATION'
  | 'SUBSCRIPTION_PAYMENT'
  | 'SUBSCRIPTION_CANCELLATION'
  | 'TRIAL_STARTED'
  | 'TRIAL_ENDING'
  | 'TRIAL_CHARGE_FAILED'
  | 'SUBSCRIPTION_PAYMENT_FAILED'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_UPGRADED'
  | 'SUBSCRIPTION_DOWNGRADED'
  | 'DOCUMENT_EMAIL';

export type ThemeMode = 'dark' | 'light';

// Props for each template
export interface WelcomeEmailProps { name: string; mode?: ThemeMode; }
export interface PasswordResetEmailProps { customerName: string; resetLink: string; mode?: ThemeMode; }
export interface EmailVerificationEmailProps { customerName: string; verificationLink: string; verificationCode?: string; mode?: ThemeMode; }
export interface AccountDeactivationEmailProps { customerName: string; mode?: ThemeMode; }

export interface OrderConfirmationEmailProps { customerName: string; orderId: string; orderDate: string; total: string; invoiceUrl?: string; items?: { name: string; price: string }[]; mode?: ThemeMode; }
export interface PayoutNotificationEmailProps { ownerName: string; amount: string; orderId: string; date: string; invoiceUrl?: string; mode?: ThemeMode; }
export interface RefundConfirmationEmailProps { customerName: string; refundAmount: string; orderId: string; reason?: string; refundDate: string; mode?: ThemeMode; }
export interface OrderCancelledEmailProps { customerName: string; orderId: string; studioName?: string; mode?: ThemeMode; }

export interface NewBookingVendorEmailProps { ownerName: string; studioName: string; customerName: string; guestEmail: string; guestPhone: string; serviceName: string; dateTime: string; duration: string; bookingUrl?: string; mode?: ThemeMode; }
export interface BookingConfirmedCustomerEmailProps { customerName: string; studioName: string; serviceName: string; dateTime: string; duration: string; location: string; totalPaid: string; invoiceUrl?: string; bookingUrl?: string; mode?: ThemeMode; }
export interface BookingReminderEmailProps { customerName: string; studioName: string; dateTime: string; bookingUrl?: string; mode?: ThemeMode; }
export interface BookingCancelledCustomerEmailProps { customerName: string; studioName?: string; mode?: ThemeMode; }
export interface BookingCancelledVendorEmailProps { ownerName: string; studioName?: string; customerName?: string; mode?: ThemeMode; }
export interface BookingModifiedEmailProps { customerName: string; reservationId: string; bookingUrl?: string; mode?: ThemeMode; }

export interface ReviewRequestEmailProps { customerName: string; studioName?: string; reviewUrl?: string; mode?: ThemeMode; }

export interface SubscriptionConfirmationEmailProps { customerName: string; planName: string; startDate: string; mode?: ThemeMode; }
export interface SubscriptionPaymentEmailProps { customerName: string; planName: string; price: string; nextBillingDate: string; mode?: ThemeMode; }
export interface SubscriptionCancellationEmailProps { customerName: string; planName?: string; mode?: ThemeMode; }
export interface TrialStartedEmailProps { customerName: string; planName: string; price: string; trialEndDate: string; mode?: ThemeMode; }
export interface TrialEndingEmailProps { customerName: string; planName: string; price: string; daysRemaining: number; trialEndDate: string; mode?: ThemeMode; }
export interface TrialChargeFailedEmailProps { customerName: string; planName: string; price: string; failureReason?: string; mode?: ThemeMode; }
export interface SubscriptionPaymentFailedEmailProps { customerName: string; planName: string; price: string; failureReason?: string; mode?: ThemeMode; }
export interface SubscriptionExpiringEmailProps { customerName: string; planName?: string; nextBillingDate: string; mode?: ThemeMode; }
export interface SubscriptionUpgradedEmailProps { customerName: string; planName: string; mode?: ThemeMode; }
export interface SubscriptionDowngradedEmailProps { customerName: string; planName: string; mode?: ThemeMode; }

export interface DocumentEmailProps { customerName: string; documentName: string; documentUrl: string; documentNumber?: string; mode?: ThemeMode; }
