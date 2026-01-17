import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';
import { getSellerDetails } from '../../utils/payoutUtils.js';

const apiKey = process.env.BREVO_EMAIL_API_KEY as string;
const apiInstance = new TransactionalEmailsApi();
apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);

// ===========================================
// Brevo Template IDs - Update these in Brevo
// ===========================================
export const BREVO_TEMPLATE_IDS = {
  // Authentication & Account (1-5)
  SIGNUP_CONFIRMATION_LEGACY: 1,
  PASSWORD_RESET: 14,
  WELCOME_SIGNUP: 13,
  EMAIL_VERIFICATION: 15,
  ACCOUNT_DEACTIVATION: 16,
  // Transactions (6-9)
  PURCHASE_CONFIRMATION: 17,
  PAYOUT_CONFIRMATION: 18,
  REFUND_CONFIRMATION: 19,
  ORDER_CANCELLED: 20,
  // Bookings (10-15)
  NEW_BOOKING_VENDOR: 21,
  BOOKING_CONFIRMED_CUSTOMER: 22,
  BOOKING_REMINDER: 23,
  BOOKING_CANCELLED_CUSTOMER: 24,
  BOOKING_CANCELLED_VENDOR: 25,
  BOOKING_MODIFIED: 26,
  // Reviews (16)
  REQUEST_REVIEW: 27,
  // Subscriptions (17-27)
  SUBSCRIPTION_ACTIVATED: 28,
  SUBSCRIPTION_PAYMENT_CONFIRMATION: 29,
  SUBSCRIPTION_CANCELLATION: 30,
  TRIAL_STARTED: 31,  
  TRIAL_ENDING_REMINDER: 32,
  TRIAL_CHARGE_FAILED: 33,
  SUBSCRIPTION_PAYMENT_FAILED: 34,
  SUBSCRIPTION_EXPIRING: 35,
  SUBSCRIPTION_UPGRADED: 36,
  SUBSCRIPTION_DOWNGRADED: 38,
  // Documents (27)
  INVOICE_DOCUMENT_SENT: 37
} as const;

// ===========================================
// Base Email Interface & Sender
// ===========================================
interface EmailParams {
  to: { email: string; name?: string }[];
  templateId: number;
  params?: Record<string, any>;
}

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

// ===========================================
// Helper Functions
// ===========================================
const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('he-IL');
};

const formatPrice = (price: number): string => {
  return `₪${price.toFixed(2)}`;
};

// ===========================================
// Authentication & Account Emails
// ===========================================

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: userName }],
    templateId: BREVO_TEMPLATE_IDS.WELCOME_SIGNUP,
    params: {
      customerName: userName,
    }
  });
};

/**
 * Send email verification link
 */
export const sendEmailVerification = async (
  userEmail: string,
  userName: string,
  verificationToken: string
) => {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  return sendTemplateEmail({
    to: [{ email: userEmail, name: userName }],
    templateId: BREVO_TEMPLATE_IDS.EMAIL_VERIFICATION,
    params: {
      customerName: userName,
      verificationLink,
      verificationCode: verificationToken.slice(0, 6).toUpperCase() // Short code for display
    }
  });
};

/**
 * Send password reset email
 */
export const sendPasswordReset = async (userEmail: string, resetToken: string) => {
  return sendTemplateEmail({
    to: [{ email: userEmail }],
    templateId: BREVO_TEMPLATE_IDS.PASSWORD_RESET,
    params: {
      resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
    }
  });
};

/**
 * Send account deactivation confirmation
 */
export const sendAccountDeactivation = async (userEmail: string, userName: string) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: userName }],
    templateId: BREVO_TEMPLATE_IDS.ACCOUNT_DEACTIVATION,
    params: {
      customerName: userName,
      deactivationDate: formatDate(new Date())
    }
  });
};

// ===========================================
// Transaction Emails
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

/**
 * Send order/purchase confirmation to customer
 */
export const sendOrderConfirmation = async (userEmail: string, orderDetails: OrderDetails) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: orderDetails.customerName }],
    templateId: BREVO_TEMPLATE_IDS.PURCHASE_CONFIRMATION,
    params: {
      customerName: orderDetails.customerName,
      orderNumber: orderDetails.id,
      orderDate: orderDetails.orderDate,
      paymentStatus: orderDetails.paymentStatus,
      items: orderDetails.items,
      totalPaid: formatPrice(orderDetails.total),
      invoiceUrl: orderDetails.invoiceUrl,
      orderUrl: `${process.env.FRONTEND_URL}/orders/${orderDetails.id}`
    }
  });
};

/**
 * Send payout notification to vendor/seller
 */
export const sendPayoutNotification = async (
  sellerId: string,
  amount: number,
  orderId: string,
  invoiceUrl: string
) => {
  try {
    const seller = await getSellerDetails(sellerId);

    return sendTemplateEmail({
      to: [{
        email: seller.email || 'admin@studioz.online',
        name: seller.name
      }],
      templateId: BREVO_TEMPLATE_IDS.PAYOUT_CONFIRMATION,
      params: {
        ownerName: seller.name,
        payoutAmount: formatPrice(amount),
        orderId: orderId,
        invoiceUrl: invoiceUrl,
        payoutDate: formatDate(new Date()),
        payoutUrl: `${process.env.FRONTEND_URL}/dashboard/payouts`
      }
    });
  } catch (error) {
    console.error('Error sending payout notification:', error);
    throw error;
  }
};

/**
 * Send refund confirmation to customer
 */
export const sendRefundConfirmation = async (
  userEmail: string,
  customerName: string,
  refundAmount: number,
  orderId: string,
  reason?: string
) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.REFUND_CONFIRMATION,
    params: {
      customerName,
      refundAmount: formatPrice(refundAmount),
      orderId,
      refundDate: formatDate(new Date()),
      reason: reason || 'לפי בקשת הלקוח',
      refundUrl: `${process.env.FRONTEND_URL}/orders/${orderId}`
    }
  });
};

/**
 * Send order cancellation confirmation
 */
export const sendOrderCancelled = async (
  userEmail: string,
  customerName: string,
  orderId: string,
  studioName: string,
  refundAmount?: number
) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.ORDER_CANCELLED,
    params: {
      customerName,
      reservationId: orderId,
      studioName,
      cancellationDate: formatDate(new Date()),
      refundAmount: refundAmount ? formatPrice(refundAmount) : undefined
    }
  });
};

// ===========================================
// Booking Emails
// ===========================================

interface BookingDetails {
  bookingId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  studioName: string;
  serviceName: string;
  dateTime: string;
  duration: string;
  location: string;
  totalPaid: string;
  notes?: string;
}

/**
 * Send new booking notification to vendor/owner
 */
export const sendNewBookingVendor = async (
  ownerEmail: string,
  ownerName: string,
  booking: BookingDetails
) => {
  return sendTemplateEmail({
    to: [{ email: ownerEmail, name: ownerName }],
    templateId: BREVO_TEMPLATE_IDS.NEW_BOOKING_VENDOR,
    params: {
      ownerName,
      customerName: booking.customerName,
      guestEmail: booking.customerEmail,
      guestPhone: booking.customerPhone,
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      duration: booking.duration,
      location: booking.location,
      totalPaid: booking.totalPaid,
      reservationId: booking.bookingId,
      notes: booking.notes || 'אין',
      bookingUrl: `${process.env.FRONTEND_URL}/dashboard/bookings/${booking.bookingId}`
    }
  });
};

/**
 * Send booking confirmation to customer
 */
export const sendBookingConfirmedCustomer = async (
  customerEmail: string,
  booking: BookingDetails
) => {
  return sendTemplateEmail({
    to: [{ email: customerEmail, name: booking.customerName }],
    templateId: BREVO_TEMPLATE_IDS.BOOKING_CONFIRMED_CUSTOMER,
    params: {
      customerName: booking.customerName,
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      experienceName: booking.serviceName,
      dateTime: booking.dateTime,
      duration: booking.duration,
      location: booking.location,
      totalPaid: booking.totalPaid,
      reservationId: booking.bookingId,
      notes: booking.notes || 'אין',
      bookingUrl: `${process.env.FRONTEND_URL}/reservations/${booking.bookingId}`
    }
  });
};

/**
 * Send booking reminder to customer
 */
export const sendBookingReminder = async (
  customerEmail: string,
  booking: BookingDetails,
  hoursUntil: number = 24
) => {
  return sendTemplateEmail({
    to: [{ email: customerEmail, name: booking.customerName }],
    templateId: BREVO_TEMPLATE_IDS.BOOKING_REMINDER,
    params: {
      customerName: booking.customerName,
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      duration: booking.duration,
      location: booking.location,
      hoursUntil,
      bookingUrl: `${process.env.FRONTEND_URL}/reservations/${booking.bookingId}`
    }
  });
};

/**
 * Send booking cancellation to customer
 */
export const sendBookingCancelledCustomer = async (
  customerEmail: string,
  customerName: string,
  booking: Partial<BookingDetails>,
  refundAmount?: number,
  reason?: string
) => {
  return sendTemplateEmail({
    to: [{ email: customerEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.BOOKING_CANCELLED_CUSTOMER,
    params: {
      customerName,
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      reservationId: booking.bookingId,
      cancellationDate: formatDate(new Date()),
      refundAmount: refundAmount ? formatPrice(refundAmount) : undefined,
      reason
    }
  });
};

/**
 * Send booking cancellation to vendor
 */
export const sendBookingCancelledVendor = async (
  ownerEmail: string,
  ownerName: string,
  booking: Partial<BookingDetails>,
  cancelledBy: 'customer' | 'system' = 'customer'
) => {
  return sendTemplateEmail({
    to: [{ email: ownerEmail, name: ownerName }],
    templateId: BREVO_TEMPLATE_IDS.BOOKING_CANCELLED_VENDOR,
    params: {
      ownerName,
      customerName: booking.customerName,
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      reservationId: booking.bookingId,
      cancellationDate: formatDate(new Date()),
      cancelledBy: cancelledBy === 'customer' ? 'הלקוח' : 'המערכת'
    }
  });
};

/**
 * Send booking modification notification
 */
export const sendBookingModified = async (
  customerEmail: string,
  customerName: string,
  booking: Partial<BookingDetails>,
  changes: string
) => {
  return sendTemplateEmail({
    to: [{ email: customerEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.BOOKING_MODIFIED,
    params: {
      customerName,
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      reservationId: booking.bookingId,
      changes,
      bookingUrl: `${process.env.FRONTEND_URL}/reservations/${booking.bookingId}`
    }
  });
};

// ===========================================
// Review Emails
// ===========================================

/**
 * Request a review from customer after their booking
 */
export const sendReviewRequest = async (
  customerEmail: string,
  customerName: string,
  studioName: string,
  studioId: string,
  bookingId: string
) => {
  return sendTemplateEmail({
    to: [{ email: customerEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.REQUEST_REVIEW,
    params: {
      customerName,
      studioName,
      reviewUrl: `${process.env.FRONTEND_URL}/studio/${studioId}/review?booking=${bookingId}`
    }
  });
};

// ===========================================
// Subscription Emails
// ===========================================

interface SubscriptionDetails {
  planName: string;
  planPrice: number;
  subscriptionId: string;
  startDate: Date | string;
  customerName: string;
  invoiceUrl?: string;
}

type SubscriptionEmailType = 'activation' | 'payment' | 'cancellation';

/**
 * Send subscription confirmation (activation, payment, or cancellation)
 */
export const sendSubscriptionConfirmation = async (
  userEmail: string,
  details: SubscriptionDetails,
  type: SubscriptionEmailType
) => {
  const templateMap: Record<SubscriptionEmailType, number> = {
    activation: BREVO_TEMPLATE_IDS.SUBSCRIPTION_ACTIVATED,
    payment: BREVO_TEMPLATE_IDS.SUBSCRIPTION_PAYMENT_CONFIRMATION,
    cancellation: BREVO_TEMPLATE_IDS.SUBSCRIPTION_CANCELLATION
  };

  const startDate = typeof details.startDate === 'string'
    ? new Date(details.startDate)
    : details.startDate;

  const baseParams = {
    customerName: details.customerName,
    planName: details.planName,
    price: formatPrice(details.planPrice),
    subscriptionId: details.subscriptionId,
    startDate: formatDate(startDate)
  };

  const additionalParams: Record<string, any> = {};

  if (type !== 'cancellation') {
    additionalParams.nextBillingDate = formatDate(
      new Date(startDate.getTime() + (type === 'activation' ? 14 : 30) * 24 * 60 * 60 * 1000)
    );
  }

  if (details.invoiceUrl && type !== 'cancellation') {
    additionalParams.invoiceUrl = details.invoiceUrl;
  }

  if (type === 'cancellation') {
    additionalParams.cancellationDate = formatDate(new Date());
    additionalParams.accessEndDate = formatDate(
      new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    );
  }

  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: templateMap[type],
    params: { ...baseParams, ...additionalParams }
  });
};

/**
 * Send trial started confirmation
 */
export const sendTrialStartedEmail = async (
  userEmail: string,
  details: {
    customerName: string;
    planName: string;
    trialEndDate: Date | string;
    trialDays: number;
    planPrice: number;
  }
) => {
  const trialEndDate = typeof details.trialEndDate === 'string'
    ? new Date(details.trialEndDate)
    : details.trialEndDate;

  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: BREVO_TEMPLATE_IDS.TRIAL_STARTED,
    params: {
      customerName: details.customerName,
      planName: details.planName,
      trialEndDate: formatDate(trialEndDate),
      trialDays: details.trialDays,
      price: formatPrice(details.planPrice),
      actionUrl: `${process.env.FRONTEND_URL}/dashboard`
    }
  });
};

/**
 * Send trial ending reminder
 */
export const sendTrialEndingEmail = async (
  userEmail: string,
  details: {
    customerName: string;
    planName: string;
    planPrice: number;
    trialEndDate: Date | string;
    daysRemaining: number;
  }
) => {
  const trialEndDate = typeof details.trialEndDate === 'string'
    ? new Date(details.trialEndDate)
    : details.trialEndDate;

  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: BREVO_TEMPLATE_IDS.TRIAL_ENDING_REMINDER,
    params: {
      customerName: details.customerName,
      planName: details.planName,
      price: formatPrice(details.planPrice),
      trialEndDate: formatDate(trialEndDate),
      daysRemaining: details.daysRemaining,
      actionUrl: `${process.env.FRONTEND_URL}/profile/subscription`
    }
  });
};

/**
 * Send trial charge failed email
 */
export const sendTrialChargeFailedEmail = async (
  userEmail: string,
  details: {
    customerName: string;
    planName: string;
    planPrice: number;
    subscriptionId: string;
    failureReason?: string;
  }
) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: BREVO_TEMPLATE_IDS.TRIAL_CHARGE_FAILED,
    params: {
      customerName: details.customerName,
      planName: details.planName,
      price: formatPrice(details.planPrice),
      subscriptionId: details.subscriptionId,
      failureReason: details.failureReason || 'פרטי כרטיס לא מעודכנים או חוסר במסגרת אשראי',
      actionUrl: `${process.env.FRONTEND_URL}/profile/billing`
    }
  });
};

/**
 * Send subscription payment failed email
 */
export const sendSubscriptionPaymentFailed = async (
  userEmail: string,
  details: {
    customerName: string;
    planName: string;
    planPrice: number;
    failureReason?: string;
  }
) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: BREVO_TEMPLATE_IDS.SUBSCRIPTION_PAYMENT_FAILED,
    params: {
      customerName: details.customerName,
      planName: details.planName,
      price: formatPrice(details.planPrice),
      failureReason: details.failureReason || 'פרטי כרטיס לא מעודכנים או חוסר במסגרת אשראי',
      actionUrl: `${process.env.FRONTEND_URL}/profile/billing`
    }
  });
};

/**
 * Send subscription expiring reminder
 */
export const sendSubscriptionExpiring = async (
  userEmail: string,
  details: {
    customerName: string;
    planName: string;
    expirationDate: Date | string;
    daysRemaining: number;
  }
) => {
  const expirationDate = typeof details.expirationDate === 'string'
    ? new Date(details.expirationDate)
    : details.expirationDate;

  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: BREVO_TEMPLATE_IDS.SUBSCRIPTION_EXPIRING,
    params: {
      customerName: details.customerName,
      planName: details.planName,
      nextBillingDate: formatDate(expirationDate),
      daysRemaining: details.daysRemaining,
      actionUrl: `${process.env.FRONTEND_URL}/profile/subscription`
    }
  });
};

/**
 * Send subscription upgraded confirmation
 */
export const sendSubscriptionUpgraded = async (
  userEmail: string,
  details: {
    customerName: string;
    oldPlanName: string;
    newPlanName: string;
    newPrice: number;
  }
) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: BREVO_TEMPLATE_IDS.SUBSCRIPTION_UPGRADED,
    params: {
      customerName: details.customerName,
      oldPlanName: details.oldPlanName,
      planName: details.newPlanName,
      price: formatPrice(details.newPrice),
      actionUrl: `${process.env.FRONTEND_URL}/profile`
    }
  });
};

/**
 * Send subscription downgraded confirmation
 */
export const sendSubscriptionDowngraded = async (
  userEmail: string,
  details: {
    customerName: string;
    oldPlanName: string;
    newPlanName: string;
    newPrice: number;
    effectiveDate: Date | string;
  }
) => {
  const effectiveDate = typeof details.effectiveDate === 'string'
    ? new Date(details.effectiveDate)
    : details.effectiveDate;

  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: BREVO_TEMPLATE_IDS.SUBSCRIPTION_DOWNGRADED,
    params: {
      customerName: details.customerName,
      oldPlanName: details.oldPlanName,
      planName: details.newPlanName,
      price: formatPrice(details.newPrice),
      effectiveDate: formatDate(effectiveDate),
      actionUrl: `${process.env.FRONTEND_URL}/profile`
    }
  });
};

// ===========================================
// Document Emails
// ===========================================

/**
 * Send document/invoice email
 */
export const sendDocumentEmail = async (
  userEmail: string,
  customerName: string,
  documentName: string,
  documentUrl: string,
  documentNumber?: string
) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.INVOICE_DOCUMENT_SENT,
    params: {
      customerName,
      documentName,
      documentNumber: documentNumber || '',
      documentUrl
    }
  });
};
