import { render } from '@react-email/render';
import { EMAIL_SUBJECTS } from './subjects.js';
import type { EmailTemplateName, ThemeMode } from './types.js';

// Import all templates
import { WelcomeEmail } from './templates/auth/WelcomeEmail.js';
import { PasswordResetEmail } from './templates/auth/PasswordResetEmail.js';
import { EmailVerificationEmail } from './templates/auth/EmailVerificationEmail.js';
import { AccountDeactivationEmail } from './templates/auth/AccountDeactivationEmail.js';
import { OrderConfirmationEmail } from './templates/transactions/OrderConfirmationEmail.js';
import { PayoutNotificationEmail } from './templates/transactions/PayoutNotificationEmail.js';
import { RefundConfirmationEmail } from './templates/transactions/RefundConfirmationEmail.js';
import { OrderCancelledEmail } from './templates/transactions/OrderCancelledEmail.js';
import { NewBookingVendorEmail } from './templates/bookings/NewBookingVendorEmail.js';
import { BookingConfirmedCustomerEmail } from './templates/bookings/BookingConfirmedCustomerEmail.js';
import { BookingReminderEmail } from './templates/bookings/BookingReminderEmail.js';
import { BookingCancelledCustomerEmail } from './templates/bookings/BookingCancelledCustomerEmail.js';
import { BookingCancelledVendorEmail } from './templates/bookings/BookingCancelledVendorEmail.js';
import { BookingModifiedEmail } from './templates/bookings/BookingModifiedEmail.js';
import { ReviewRequestEmail } from './templates/reviews/ReviewRequestEmail.js';
import { SubscriptionConfirmationEmail } from './templates/subscriptions/SubscriptionConfirmationEmail.js';
import { SubscriptionPaymentEmail } from './templates/subscriptions/SubscriptionPaymentEmail.js';
import { SubscriptionCancellationEmail } from './templates/subscriptions/SubscriptionCancellationEmail.js';
import { TrialStartedEmail } from './templates/subscriptions/TrialStartedEmail.js';
import { TrialEndingEmail } from './templates/subscriptions/TrialEndingEmail.js';
import { TrialChargeFailedEmail } from './templates/subscriptions/TrialChargeFailedEmail.js';
import { SubscriptionPaymentFailedEmail } from './templates/subscriptions/SubscriptionPaymentFailedEmail.js';
import { SubscriptionExpiringEmail } from './templates/subscriptions/SubscriptionExpiringEmail.js';
import { SubscriptionUpgradedEmail } from './templates/subscriptions/SubscriptionUpgradedEmail.js';
import { SubscriptionDowngradedEmail } from './templates/subscriptions/SubscriptionDowngradedEmail.js';
import { DocumentEmail } from './templates/documents/DocumentEmail.js';

// Map template names to their render functions
// Each function takes (props, mode) and returns a JSX element
const TEMPLATE_MAP: Record<EmailTemplateName, (props: any) => React.JSX.Element> = {
  WELCOME: (p) => WelcomeEmail(p),
  PASSWORD_RESET: (p) => PasswordResetEmail(p),
  EMAIL_VERIFICATION: (p) => EmailVerificationEmail(p),
  ACCOUNT_DEACTIVATION: (p) => AccountDeactivationEmail(p),
  ORDER_CONFIRMATION: (p) => OrderConfirmationEmail(p),
  PAYOUT_NOTIFICATION: (p) => PayoutNotificationEmail(p),
  REFUND_CONFIRMATION: (p) => RefundConfirmationEmail(p),
  ORDER_CANCELLED: (p) => OrderCancelledEmail(p),
  NEW_BOOKING_VENDOR: (p) => NewBookingVendorEmail(p),
  BOOKING_CONFIRMED_CUSTOMER: (p) => BookingConfirmedCustomerEmail(p),
  BOOKING_REMINDER: (p) => BookingReminderEmail(p),
  BOOKING_CANCELLED_CUSTOMER: (p) => BookingCancelledCustomerEmail(p),
  BOOKING_CANCELLED_VENDOR: (p) => BookingCancelledVendorEmail(p),
  BOOKING_MODIFIED: (p) => BookingModifiedEmail(p),
  REVIEW_REQUEST: (p) => ReviewRequestEmail(p),
  SUBSCRIPTION_CONFIRMATION: (p) => SubscriptionConfirmationEmail(p),
  SUBSCRIPTION_PAYMENT: (p) => SubscriptionPaymentEmail(p),
  SUBSCRIPTION_CANCELLATION: (p) => SubscriptionCancellationEmail(p),
  TRIAL_STARTED: (p) => TrialStartedEmail(p),
  TRIAL_ENDING: (p) => TrialEndingEmail(p),
  TRIAL_CHARGE_FAILED: (p) => TrialChargeFailedEmail(p),
  SUBSCRIPTION_PAYMENT_FAILED: (p) => SubscriptionPaymentFailedEmail(p),
  SUBSCRIPTION_EXPIRING: (p) => SubscriptionExpiringEmail(p),
  SUBSCRIPTION_UPGRADED: (p) => SubscriptionUpgradedEmail(p),
  SUBSCRIPTION_DOWNGRADED: (p) => SubscriptionDowngradedEmail(p),
  DOCUMENT_EMAIL: (p) => DocumentEmail(p),
};

export async function renderEmail(
  templateName: EmailTemplateName,
  props: Record<string, any>,
  mode: ThemeMode = 'dark'
): Promise<{ html: string; subject: string }> {
  const factory = TEMPLATE_MAP[templateName];
  if (!factory) {
    throw new Error(`Unknown email template: ${templateName}`);
  }
  const element = factory({ ...props, mode });
  const html = await render(element);
  const subject = EMAIL_SUBJECTS[templateName];
  return { html, subject };
}
