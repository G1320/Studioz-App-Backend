import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';
import { getSellerDetails } from '../../utils/payoutUtils.js';

const apiKey = process.env.BREVO_EMAIL_API_KEY as string;
const apiInstance = new TransactionalEmailsApi();
apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);

// ===========================================
// Brevo Template IDs - Configure in Brevo Dashboard
// ===========================================
export const BREVO_TEMPLATE_IDS = {
  // Auth & Account
  WELCOME: 6,
  PASSWORD_RESET: 4,
  EMAIL_VERIFICATION: 14,
  ACCOUNT_DEACTIVATION: 15,
  
  // Transactions
  ORDER_CONFIRMATION: 5,
  PAYOUT_NOTIFICATION: 7,
  REFUND_CONFIRMATION: 16,
  ORDER_CANCELLED: 17,
  
  // Bookings
  NEW_BOOKING_VENDOR: 18,
  BOOKING_CONFIRMED_CUSTOMER: 19,
  BOOKING_REMINDER: 20,
  BOOKING_CANCELLED_CUSTOMER: 21,
  BOOKING_CANCELLED_VENDOR: 22,
  BOOKING_MODIFIED: 23,
  
  // Reviews
  REVIEW_REQUEST: 24,
  
  // Subscriptions
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
  
  // Documents
  DOCUMENT_EMAIL: 29
} as const;

interface EmailParams {
  to: { email: string; name?: string }[];
  templateId: number;
  params?: Record<string, any>;
}

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

interface SubscriptionEmailConfig {
  templateId: number;
  includeNextBilling: boolean;
  includeInvoice: boolean;
}

export const sendSubscriptionConfirmation = async (
  userEmail: string, 
  details: SubscriptionDetails,
  type: EmailType
) => {
  // Get template configuration based on type
  const emailConfig: Record<EmailType, SubscriptionEmailConfig> = {
    activation: {
      templateId: 10,
      includeNextBilling: true,
      includeInvoice: true
    },
    payment: {
      templateId: 8,
      includeNextBilling: true,
      includeInvoice: true
    },
    cancellation: {
      templateId: 9,
      includeNextBilling: false,
      includeInvoice: false
    }
  };

  const config = emailConfig[type];

  // Convert startDate to Date object if it's a string
  const startDate = typeof details.startDate === 'string' 
    ? new Date(details.startDate)
    : details.startDate;

  // Base params that are common to all types
  const baseParams = {
    customerName: details.customerName,
    planName: details.planName,
    amount: details.planPrice.toFixed(2),
    subscriptionId: details.subscriptionId,
    startDate: startDate.toLocaleDateString('he-IL')
  };

  // Add optional params based on type
  const additionalParams = {
    ...(config.includeNextBilling ? {
      nextBillingDate: new Date(
        startDate.getTime() + (type === 'activation' ? 14 : 30) * 24 * 60 * 60 * 1000
      ).toLocaleDateString('he-IL')
    } : {}),
    ...(config.includeInvoice && details.invoiceUrl ? {
      invoiceUrl: details.invoiceUrl
    } : {}),
    ...(type === 'cancellation' ? {
      cancellationDate: new Date().toLocaleDateString('he-IL')
    } : {})
  };

  return sendTemplateEmail({
    to: [{ 
      email: userEmail,
      name: details.customerName 
    }],
    templateId: config.templateId,
    params: {
      ...baseParams,
      ...additionalParams
    }
  });
};

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

export const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  
  return sendTemplateEmail({
    to: [{ email: userEmail, name: userName }],
    templateId: 6, 
    params: {
      name: userName,
    }
  });
};


export const sendOrderConfirmation = async (userEmail: string, orderDetails: OrderDetails) => {
  
  return sendTemplateEmail({
    to: [{ email: userEmail }],
    templateId: 5,
    params: {
      customerName: orderDetails.customerName,
      id: orderDetails.id,            
      orderDate: orderDetails.orderDate,
      paymentStatus: orderDetails.paymentStatus,
      items: orderDetails.items,       
      total: orderDetails.total   ,
      invoiceUrl: orderDetails.invoiceUrl      
    }
  });
};

export const sendPayoutNotification = async (
  sellerId: string,
  amount: number,
  orderId:string,
  invoiceUrl: string
) => {
  try {
    const seller = await getSellerDetails(sellerId);

    return sendTemplateEmail({
      to: [{ 
        email: seller.email || 'admin@studioz.online',
        name: seller.name
      }],
      templateId: 7, 
      params: {
        sellerName: seller.name,
        amount: amount.toFixed(2),
        orderId: orderId,
        invoiceUrl: invoiceUrl,
        date: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Error sending payout notification:', error);
    throw error;
  }
};

export const sendPasswordReset = async (userEmail: string, resetToken: string) => {
  return sendTemplateEmail({
    to: [{ email: userEmail }],
    templateId: 4,
    params: {
      resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
    }
  });
};

// Trial subscription email interfaces
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

/**
 * Send trial ending reminder email
 * Template ID 11 - configure in Brevo with params: customerName, planName, planPrice, trialEndDate, daysRemaining
 */
export const sendTrialEndingEmail = async (
  userEmail: string,
  details: TrialEndingDetails
) => {
  const trialEndDate = typeof details.trialEndDate === 'string'
    ? new Date(details.trialEndDate)
    : details.trialEndDate;

  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: 11, // Trial ending reminder template - create in Brevo
    params: {
      customerName: details.customerName,
      planName: details.planName,
      planPrice: details.planPrice.toFixed(2),
      trialEndDate: trialEndDate.toLocaleDateString('he-IL'),
      daysRemaining: details.daysRemaining
    }
  });
};

/**
 * Send trial charge failed email
 * Template ID 12 - configure in Brevo with params: customerName, planName, subscriptionId
 */
export const sendTrialChargeFailedEmail = async (
  userEmail: string,
  details: TrialChargeFailedDetails
) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: 12, // Trial charge failed template - create in Brevo
    params: {
      customerName: details.customerName,
      planName: details.planName,
      subscriptionId: details.subscriptionId
    }
  });
};

/**
 * Send trial started confirmation email
 * Template ID 13 - configure in Brevo with params: customerName, planName, trialEndDate, trialDays
 */
export const sendTrialStartedEmail = async (
  userEmail: string,
  details: TrialStartedDetails
) => {
  const trialEndDate = typeof details.trialEndDate === 'string'
    ? new Date(details.trialEndDate)
    : details.trialEndDate;

  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: 13, // Trial started template - create in Brevo
    params: {
      customerName: details.customerName,
      planName: details.planName,
      trialEndDate: trialEndDate.toLocaleDateString('he-IL'),
      trialDays: details.trialDays
    }
  });
};

// ===========================================
// Auth & Account Emails
// ===========================================

export const sendEmailVerification = async (userEmail: string, userName: string, verificationToken: string) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: userName }],
    templateId: BREVO_TEMPLATE_IDS.EMAIL_VERIFICATION,
    params: {
      customerName: userName,
      verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
      verificationCode: verificationToken.substring(0, 6).toUpperCase()
    }
  });
};

export const sendAccountDeactivation = async (userEmail: string, userName: string) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: userName }],
    templateId: BREVO_TEMPLATE_IDS.ACCOUNT_DEACTIVATION,
    params: {
      customerName: userName,
      deactivationDate: new Date().toLocaleDateString('he-IL')
    }
  });
};

// ===========================================
// Transaction Emails
// ===========================================

export const sendRefundConfirmation = async (userEmail: string, customerName: string, refundAmount: number, orderId: string, reason?: string) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.REFUND_CONFIRMATION,
    params: {
      customerName,
      refundAmount: `₪${refundAmount.toFixed(2)}`,
      orderId,
      reason: reason || 'לפי בקשת הלקוח',
      refundDate: new Date().toLocaleDateString('he-IL')
    }
  });
};

export const sendOrderCancelled = async (userEmail: string, customerName: string, orderId: string, studioName: string, refundAmount?: number) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.ORDER_CANCELLED,
    params: {
      customerName,
      orderId,
      studioName,
      refundAmount: refundAmount ? `₪${refundAmount.toFixed(2)}` : undefined,
      cancellationDate: new Date().toLocaleDateString('he-IL')
    }
  });
};

// ===========================================
// Booking Emails
// ===========================================

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

export const sendNewBookingVendor = async (ownerEmail: string, ownerName: string, booking: BookingDetails) => {
  return sendTemplateEmail({
    to: [{ email: ownerEmail, name: ownerName }],
    templateId: BREVO_TEMPLATE_IDS.NEW_BOOKING_VENDOR,
    params: {
      ownerName,
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      duration: booking.duration,
      bookingId: booking.id,
      totalPaid: booking.totalPaid ? `₪${booking.totalPaid.toFixed(2)}` : undefined,
      notes: booking.notes
    }
  });
};

export const sendBookingConfirmedCustomer = async (customerEmail: string, booking: BookingDetails & { customerName?: string }) => {
  return sendTemplateEmail({
    to: [{ email: customerEmail, name: booking.customerName }],
    templateId: BREVO_TEMPLATE_IDS.BOOKING_CONFIRMED_CUSTOMER,
    params: {
      customerName: booking.customerName || 'לקוח יקר',
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      duration: booking.duration,
      location: booking.location,
      bookingId: booking.id,
      totalPaid: booking.totalPaid ? `₪${booking.totalPaid.toFixed(2)}` : undefined,
      notes: booking.notes
    }
  });
};

export const sendBookingReminder = async (customerEmail: string, booking: BookingDetails & { customerName?: string }, hoursUntil: number = 24) => {
  return sendTemplateEmail({
    to: [{ email: customerEmail, name: booking.customerName }],
    templateId: BREVO_TEMPLATE_IDS.BOOKING_REMINDER,
    params: {
      customerName: booking.customerName || 'לקוח יקר',
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      duration: booking.duration,
      location: booking.location,
      bookingId: booking.id,
      hoursUntil
    }
  });
};

export const sendBookingCancelledCustomer = async (customerEmail: string, customerName: string, booking: BookingDetails, refundAmount?: number, reason?: string) => {
  return sendTemplateEmail({
    to: [{ email: customerEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.BOOKING_CANCELLED_CUSTOMER,
    params: {
      customerName,
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      bookingId: booking.id,
      refundAmount: refundAmount ? `₪${refundAmount.toFixed(2)}` : undefined,
      reason: reason || 'ביטול הזמנה',
      cancellationDate: new Date().toLocaleDateString('he-IL')
    }
  });
};

export const sendBookingCancelledVendor = async (ownerEmail: string, ownerName: string, booking: BookingDetails, cancelledBy: string = 'customer') => {
  return sendTemplateEmail({
    to: [{ email: ownerEmail, name: ownerName }],
    templateId: BREVO_TEMPLATE_IDS.BOOKING_CANCELLED_VENDOR,
    params: {
      ownerName,
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      bookingId: booking.id,
      cancelledBy: cancelledBy === 'customer' ? 'הלקוח' : 'בעל הסטודיו',
      cancellationDate: new Date().toLocaleDateString('he-IL')
    }
  });
};

export const sendBookingModified = async (customerEmail: string, customerName: string, booking: BookingDetails, changes: string) => {
  return sendTemplateEmail({
    to: [{ email: customerEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.BOOKING_MODIFIED,
    params: {
      customerName,
      studioName: booking.studioName,
      serviceName: booking.serviceName,
      dateTime: booking.dateTime,
      bookingId: booking.id,
      changes
    }
  });
};

// ===========================================
// Review Emails
// ===========================================

export const sendReviewRequest = async (customerEmail: string, customerName: string, studioName: string, studioId: string, bookingId: string) => {
  return sendTemplateEmail({
    to: [{ email: customerEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.REVIEW_REQUEST,
    params: {
      customerName,
      studioName,
      reviewUrl: `${process.env.FRONTEND_URL}/studio/${studioId}/review?booking=${bookingId}`
    }
  });
};

// ===========================================
// Subscription Status Emails
// ===========================================

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

export const sendSubscriptionPaymentFailed = async (userEmail: string, details: SubscriptionStatusDetails) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: BREVO_TEMPLATE_IDS.SUBSCRIPTION_PAYMENT_FAILED,
    params: {
      customerName: details.customerName,
      planName: details.planName,
      subscriptionId: details.subscriptionId,
      failureReason: details.failureReason || 'בעיה בעיבוד התשלום'
    }
  });
};

export const sendSubscriptionExpiring = async (userEmail: string, details: SubscriptionStatusDetails) => {
  const expirationDate = details.nextBillingDate 
    ? (typeof details.nextBillingDate === 'string' ? new Date(details.nextBillingDate) : details.nextBillingDate).toLocaleDateString('he-IL')
    : undefined;
  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: BREVO_TEMPLATE_IDS.SUBSCRIPTION_EXPIRING,
    params: {
      customerName: details.customerName,
      planName: details.planName,
      expirationDate
    }
  });
};

export const sendSubscriptionUpgraded = async (userEmail: string, details: SubscriptionStatusDetails) => {
  const effectiveDate = details.effectiveDate 
    ? (typeof details.effectiveDate === 'string' ? new Date(details.effectiveDate) : details.effectiveDate).toLocaleDateString('he-IL')
    : new Date().toLocaleDateString('he-IL');
  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: BREVO_TEMPLATE_IDS.SUBSCRIPTION_UPGRADED,
    params: {
      customerName: details.customerName,
      oldPlanName: details.oldPlanName,
      newPlanName: details.newPlanName || details.planName,
      effectiveDate
    }
  });
};

export const sendSubscriptionDowngraded = async (userEmail: string, details: SubscriptionStatusDetails) => {
  const effectiveDate = details.effectiveDate 
    ? (typeof details.effectiveDate === 'string' ? new Date(details.effectiveDate) : details.effectiveDate).toLocaleDateString('he-IL')
    : new Date().toLocaleDateString('he-IL');
  return sendTemplateEmail({
    to: [{ email: userEmail, name: details.customerName }],
    templateId: BREVO_TEMPLATE_IDS.SUBSCRIPTION_DOWNGRADED,
    params: {
      customerName: details.customerName,
      oldPlanName: details.oldPlanName,
      newPlanName: details.newPlanName || details.planName,
      effectiveDate
    }
  });
};

// ===========================================
// Document Emails
// ===========================================

export const sendDocumentEmail = async (userEmail: string, customerName: string, documentName: string, documentUrl: string, documentNumber?: string) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: customerName }],
    templateId: BREVO_TEMPLATE_IDS.DOCUMENT_EMAIL,
    params: {
      customerName,
      documentName,
      documentUrl,
      documentNumber
    }
  });
};
