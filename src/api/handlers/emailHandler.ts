import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';
import { getSellerDetails } from '../../utils/payoutUtils.js';
import { renderEmail } from '../../emails/render.js';
import type { EmailTemplateName } from '../../emails/types.js';

const apiKey = process.env.BREVO_EMAIL_API_KEY as string;
const apiInstance = new TransactionalEmailsApi();
apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);

const DEFAULT_SENDER = {
  name: 'StudioZ',
  email: process.env.BREVO_SENDER_EMAIL || 'noreply@studioz.online',
};

// ===========================================
// Brevo Template IDs — DEPRECATED (kept for rollback)
// ===========================================
export const BREVO_TEMPLATE_IDS = {
  WELCOME: 6,
  PASSWORD_RESET: 4,
  EMAIL_VERIFICATION: 14,
  ACCOUNT_DEACTIVATION: 15,
  ORDER_CONFIRMATION: 5,
  PAYOUT_NOTIFICATION: 7,
  REFUND_CONFIRMATION: 16,
  ORDER_CANCELLED: 17,
  NEW_BOOKING_VENDOR: 18,
  BOOKING_CONFIRMED_CUSTOMER: 19,
  BOOKING_REMINDER: 20,
  BOOKING_CANCELLED_CUSTOMER: 21,
  BOOKING_CANCELLED_VENDOR: 22,
  BOOKING_MODIFIED: 23,
  REVIEW_REQUEST: 24,
  SUBSCRIPTION_CONFIRMATION: 10,
  SUBSCRIPTION_PAYMENT: 8,
  SUBSCRIPTION_CANCELLATION: 9,
  TRIAL_ENDING: 11,
  TRIAL_CHARGE_FAILED: 12,
  TRIAL_STARTED: 13,
  SUBSCRIPTION_PAYMENT_FAILED: 25,
  SUBSCRIPTION_EXPIRING: 26,
  SUBSCRIPTION_UPGRADED: 27,
  SUBSCRIPTION_DOWNGRADED: 28,
  DOCUMENT_EMAIL: 29
} as const;

// ===========================================
// Core Email Sending
// ===========================================

interface EmailParams {
  to: { email: string; name?: string }[];
  templateId: number;
  params?: Record<string, any>;
}

interface HtmlEmailParams {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
}

/** @deprecated Use sendHtmlEmail with renderEmail instead */
export const sendTemplateEmail = async ({ to, templateId, params }: EmailParams) => {
  try {
    const response = await apiInstance.sendTransacEmail({
      to,
      templateId,
      params
    });
    return response;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/** Send rendered HTML email via Brevo */
export const sendHtmlEmail = async ({ to, subject, htmlContent }: HtmlEmailParams) => {
  try {
    const response = await apiInstance.sendTransacEmail({
      to,
      sender: DEFAULT_SENDER,
      subject,
      htmlContent,
    });
    return response;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// ===========================================
// Interfaces
// ===========================================

interface OrderDetails {
  id: string;
  customerName: string;
  orderDate: string;
  paymentStatus: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  invoiceUrl?: string;
}

interface PayoutNotificationParams {
  amount: number;
  orderId: string;
  invoiceUrl: string;
}

interface SubscriptionDetails {
  planName: string;
  planPrice: number;
  subscriptionId: string;
  startDate: Date;
  customerName: string;
  invoiceUrl: string;
}

type EmailType = 'activation' | 'payment' | 'cancellation';

interface TrialEndingDetails {
  customerName: string;
  planName: string;
  planPrice: number;
  trialEndDate: Date;
  daysRemaining: number;
}

interface TrialChargeFailedDetails {
  customerName: string;
  planName: string;
  subscriptionId: string;
}

interface TrialStartedDetails {
  customerName: string;
  planName: string;
  trialEndDate: Date;
  trialDays: number;
}

interface BookingDetails {
  id: string;
  studioName: string;
  serviceName: string;
  dateTime: string;
  duration: string;
  location?: string;
  totalPaid?: number;
  notes?: string;
}

interface SubscriptionStatusDetails {
  customerName: string;
  planName: string;
  subscriptionId?: string;
  failureReason?: string;
  nextBillingDate?: Date;
  oldPlanName?: string;
  newPlanName?: string;
  effectiveDate?: Date;
}

// ===========================================
// Auth & Account Emails
// ===========================================

export const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  const { html, subject } = await renderEmail('WELCOME', { name: userName });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: userName }],
    subject,
    htmlContent: html,
  });
};

export const sendPasswordReset = async (userEmail: string, resetToken: string) => {
  const { html, subject } = await renderEmail('PASSWORD_RESET', {
    customerName: '',
    resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
  });
  return sendHtmlEmail({
    to: [{ email: userEmail }],
    subject,
    htmlContent: html,
  });
};

export const sendEmailVerification = async (userEmail: string, userName: string, verificationToken: string) => {
  const { html, subject } = await renderEmail('EMAIL_VERIFICATION', {
    customerName: userName,
    verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
    verificationCode: verificationToken.substring(0, 6).toUpperCase(),
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: userName }],
    subject,
    htmlContent: html,
  });
};

export const sendAccountDeactivation = async (userEmail: string, userName: string) => {
  const { html, subject } = await renderEmail('ACCOUNT_DEACTIVATION', {
    customerName: userName,
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: userName }],
    subject,
    htmlContent: html,
  });
};

// ===========================================
// Transaction Emails
// ===========================================

export const sendOrderConfirmation = async (userEmail: string, orderDetails: OrderDetails) => {
  const { html, subject } = await renderEmail('ORDER_CONFIRMATION', {
    customerName: orderDetails.customerName,
    orderId: orderDetails.id,
    orderDate: orderDetails.orderDate,
    total: `₪${orderDetails.total.toFixed(2)}`,
    invoiceUrl: orderDetails.invoiceUrl,
    items: orderDetails.items?.map(i => ({ name: i.name, price: `₪${i.price.toFixed(2)}` })),
  });
  return sendHtmlEmail({
    to: [{ email: userEmail }],
    subject,
    htmlContent: html,
  });
};

export const sendPayoutNotification = async (
  sellerId: string,
  amount: number,
  orderId: string,
  invoiceUrl: string
) => {
  try {
    const seller = await getSellerDetails(sellerId);

    const { html, subject } = await renderEmail('PAYOUT_NOTIFICATION', {
      ownerName: seller.name,
      amount: amount.toFixed(2),
      orderId,
      invoiceUrl,
      date: new Date().toLocaleDateString('he-IL'),
    });
    return sendHtmlEmail({
      to: [{ email: seller.email || 'admin@studioz.online', name: seller.name }],
      subject,
      htmlContent: html,
    });
  } catch (error) {
    console.error('Error sending payout notification:', error);
    throw error;
  }
};

export const sendRefundConfirmation = async (userEmail: string, customerName: string, refundAmount: number, orderId: string, reason?: string) => {
  const { html, subject } = await renderEmail('REFUND_CONFIRMATION', {
    customerName,
    refundAmount: `₪${refundAmount.toFixed(2)}`,
    orderId,
    reason: reason || 'לפי בקשת הלקוח',
    refundDate: new Date().toLocaleDateString('he-IL'),
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: customerName }],
    subject,
    htmlContent: html,
  });
};

export const sendOrderCancelled = async (userEmail: string, customerName: string, orderId: string, studioName: string, refundAmount?: number) => {
  const { html, subject } = await renderEmail('ORDER_CANCELLED', {
    customerName,
    orderId,
    studioName,
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: customerName }],
    subject,
    htmlContent: html,
  });
};

// ===========================================
// Booking Emails
// ===========================================

export const sendNewBookingVendor = async (ownerEmail: string, ownerName: string, booking: BookingDetails) => {
  const { html, subject } = await renderEmail('NEW_BOOKING_VENDOR', {
    ownerName,
    studioName: booking.studioName,
    customerName: '',
    guestEmail: '',
    guestPhone: '',
    serviceName: booking.serviceName,
    dateTime: booking.dateTime,
    duration: booking.duration,
  });
  return sendHtmlEmail({
    to: [{ email: ownerEmail, name: ownerName }],
    subject,
    htmlContent: html,
  });
};

export const sendBookingConfirmedCustomer = async (customerEmail: string, booking: BookingDetails & { customerName?: string }) => {
  const { html, subject } = await renderEmail('BOOKING_CONFIRMED_CUSTOMER', {
    customerName: booking.customerName || 'לקוח יקר',
    studioName: booking.studioName,
    serviceName: booking.serviceName,
    dateTime: booking.dateTime,
    duration: booking.duration,
    location: booking.location || '',
    totalPaid: booking.totalPaid ? `₪${booking.totalPaid.toFixed(2)}` : '',
  });
  return sendHtmlEmail({
    to: [{ email: customerEmail, name: booking.customerName }],
    subject,
    htmlContent: html,
  });
};

export const sendBookingReminder = async (customerEmail: string, booking: BookingDetails & { customerName?: string }, hoursUntil: number = 24) => {
  const { html, subject } = await renderEmail('BOOKING_REMINDER', {
    customerName: booking.customerName || 'לקוח יקר',
    studioName: booking.studioName,
    dateTime: booking.dateTime,
  });
  return sendHtmlEmail({
    to: [{ email: customerEmail, name: booking.customerName }],
    subject,
    htmlContent: html,
  });
};

export const sendBookingCancelledCustomer = async (customerEmail: string, customerName: string, booking: BookingDetails, refundAmount?: number, reason?: string) => {
  const { html, subject } = await renderEmail('BOOKING_CANCELLED_CUSTOMER', {
    customerName,
    studioName: booking.studioName,
  });
  return sendHtmlEmail({
    to: [{ email: customerEmail, name: customerName }],
    subject,
    htmlContent: html,
  });
};

export const sendBookingCancelledVendor = async (ownerEmail: string, ownerName: string, booking: BookingDetails, cancelledBy: string = 'customer') => {
  const { html, subject } = await renderEmail('BOOKING_CANCELLED_VENDOR', {
    ownerName,
    studioName: booking.studioName,
  });
  return sendHtmlEmail({
    to: [{ email: ownerEmail, name: ownerName }],
    subject,
    htmlContent: html,
  });
};

export const sendBookingModified = async (customerEmail: string, customerName: string, booking: BookingDetails, changes: string) => {
  const { html, subject } = await renderEmail('BOOKING_MODIFIED', {
    customerName,
    reservationId: booking.id,
  });
  return sendHtmlEmail({
    to: [{ email: customerEmail, name: customerName }],
    subject,
    htmlContent: html,
  });
};

// ===========================================
// Review Emails
// ===========================================

export const sendReviewRequest = async (customerEmail: string, customerName: string, studioName: string, studioId: string, bookingId: string) => {
  const { html, subject } = await renderEmail('REVIEW_REQUEST', {
    customerName,
    studioName,
    reviewUrl: `${process.env.FRONTEND_URL}/studio/${studioId}/review?booking=${bookingId}`,
  });
  return sendHtmlEmail({
    to: [{ email: customerEmail, name: customerName }],
    subject,
    htmlContent: html,
  });
};

// ===========================================
// Subscription Emails
// ===========================================

export const sendSubscriptionConfirmation = async (
  userEmail: string,
  details: SubscriptionDetails,
  type: EmailType
) => {
  const templateMap: Record<EmailType, EmailTemplateName> = {
    activation: 'SUBSCRIPTION_CONFIRMATION',
    payment: 'SUBSCRIPTION_PAYMENT',
    cancellation: 'SUBSCRIPTION_CANCELLATION',
  };

  const startDate = typeof details.startDate === 'string'
    ? new Date(details.startDate)
    : details.startDate;

  const templateName = templateMap[type];

  let props: Record<string, any> = {
    customerName: details.customerName,
    planName: details.planName,
  };

  if (type === 'activation') {
    props.startDate = startDate.toLocaleDateString('he-IL');
  } else if (type === 'payment') {
    props.price = `₪${details.planPrice.toFixed(2)}`;
    props.nextBillingDate = new Date(
      startDate.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toLocaleDateString('he-IL');
  }

  const { html, subject } = await renderEmail(templateName, props);
  return sendHtmlEmail({
    to: [{ email: userEmail, name: details.customerName }],
    subject,
    htmlContent: html,
  });
};

export const sendTrialStartedEmail = async (
  userEmail: string,
  details: TrialStartedDetails
) => {
  const trialEndDate = typeof details.trialEndDate === 'string'
    ? new Date(details.trialEndDate)
    : details.trialEndDate;

  const { html, subject } = await renderEmail('TRIAL_STARTED', {
    customerName: details.customerName,
    planName: details.planName,
    price: '',
    trialEndDate: trialEndDate.toLocaleDateString('he-IL'),
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: details.customerName }],
    subject,
    htmlContent: html,
  });
};

export const sendTrialEndingEmail = async (
  userEmail: string,
  details: TrialEndingDetails
) => {
  const trialEndDate = typeof details.trialEndDate === 'string'
    ? new Date(details.trialEndDate)
    : details.trialEndDate;

  const { html, subject } = await renderEmail('TRIAL_ENDING', {
    customerName: details.customerName,
    planName: details.planName,
    price: `₪${details.planPrice.toFixed(2)}`,
    daysRemaining: details.daysRemaining,
    trialEndDate: trialEndDate.toLocaleDateString('he-IL'),
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: details.customerName }],
    subject,
    htmlContent: html,
  });
};

export const sendTrialChargeFailedEmail = async (
  userEmail: string,
  details: TrialChargeFailedDetails
) => {
  const { html, subject } = await renderEmail('TRIAL_CHARGE_FAILED', {
    customerName: details.customerName,
    planName: details.planName,
    price: '',
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: details.customerName }],
    subject,
    htmlContent: html,
  });
};

// ===========================================
// Subscription Status Emails
// ===========================================

export const sendSubscriptionPaymentFailed = async (userEmail: string, details: SubscriptionStatusDetails) => {
  const { html, subject } = await renderEmail('SUBSCRIPTION_PAYMENT_FAILED', {
    customerName: details.customerName,
    planName: details.planName,
    price: '',
    failureReason: details.failureReason || 'בעיה בעיבוד התשלום',
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: details.customerName }],
    subject,
    htmlContent: html,
  });
};

export const sendSubscriptionExpiring = async (userEmail: string, details: SubscriptionStatusDetails) => {
  const expirationDate = details.nextBillingDate
    ? (typeof details.nextBillingDate === 'string' ? new Date(details.nextBillingDate) : details.nextBillingDate).toLocaleDateString('he-IL')
    : new Date().toLocaleDateString('he-IL');
  const { html, subject } = await renderEmail('SUBSCRIPTION_EXPIRING', {
    customerName: details.customerName,
    planName: details.planName,
    nextBillingDate: expirationDate,
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: details.customerName }],
    subject,
    htmlContent: html,
  });
};

export const sendSubscriptionUpgraded = async (userEmail: string, details: SubscriptionStatusDetails) => {
  const { html, subject } = await renderEmail('SUBSCRIPTION_UPGRADED', {
    customerName: details.customerName,
    planName: details.newPlanName || details.planName,
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: details.customerName }],
    subject,
    htmlContent: html,
  });
};

export const sendSubscriptionDowngraded = async (userEmail: string, details: SubscriptionStatusDetails) => {
  const { html, subject } = await renderEmail('SUBSCRIPTION_DOWNGRADED', {
    customerName: details.customerName,
    planName: details.newPlanName || details.planName,
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: details.customerName }],
    subject,
    htmlContent: html,
  });
};

// ===========================================
// Document Emails
// ===========================================

export const sendDocumentEmail = async (userEmail: string, customerName: string, documentName: string, documentUrl: string, documentNumber?: string) => {
  const { html, subject } = await renderEmail('DOCUMENT_EMAIL', {
    customerName,
    documentName,
    documentUrl,
    documentNumber,
  });
  return sendHtmlEmail({
    to: [{ email: userEmail, name: customerName }],
    subject,
    htmlContent: html,
  });
};
