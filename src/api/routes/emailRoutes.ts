import express from 'express';
import {
  // Auth & Account
  sendWelcomeEmail,
  sendEmailVerification,
  sendPasswordReset,
  sendAccountDeactivation,
  // Transactions
  sendOrderConfirmation,
  sendPayoutNotification,
  sendRefundConfirmation,
  sendOrderCancelled,
  // Bookings
  sendNewBookingVendor,
  sendBookingConfirmedCustomer,
  sendBookingReminder,
  sendBookingCancelledCustomer,
  sendBookingCancelledVendor,
  sendBookingModified,
  // Reviews
  sendReviewRequest,
  // Subscriptions
  sendSubscriptionConfirmation,
  sendTrialStartedEmail,
  sendTrialEndingEmail,
  sendTrialChargeFailedEmail,
  sendSubscriptionPaymentFailed,
  sendSubscriptionExpiring,
  sendSubscriptionUpgraded,
  sendSubscriptionDowngraded,
  // Documents
  sendDocumentEmail,
  // Test email
  sendTemplateEmail,
  BREVO_TEMPLATE_IDS
} from '../handlers/emailHandler.js';
// import { authenticateUser } from '../middleware/auth'; // Assuming you have auth middleware

import { formatOrderDetails } from '../../utils/orderFormatter.js';
import { formatInvoiceData } from '../../utils/invoiceFormatter.js';

import rateLimit from 'express-rate-limit';
import { CreateInvoiceData, createInvoice, createPayoutInvoice } from '../handlers/invoiceHandler.js';
import { calculateMarketplaceFee } from '../handlers/paypalHandlers/orderHandler.js';
import { NODE_ENV } from '../../config/index.js';

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many email requests from this IP, please try again after 15 minutes'
});

const router = express.Router();

router.post('/send-welcome',  async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    await sendWelcomeEmail(email, name);
    res.status(200).json({ message: 'Welcome email sent successfully' });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    res.status(500).json({ error: 'Failed to send welcome email' });
  }
});

router.post('/send-subscription-confirmation', async (req, res) => {
  try {
    const { email, subscriptionData } = req.body;

    if (!email || !subscriptionData) {
      return res.status(400).json({ error: 'Email and subscription details are required' });
    }

    // Format subscription details for invoice
    const invoiceData: CreateInvoiceData = {
      type: 300, // Invoice + Receipt
      client: {
        name: subscriptionData.customerName,
        email: email
      },
      income: [
        {
          description: `${subscriptionData.planName} Subscription`,
          quantity: 1,
          price: subscriptionData.planPrice
        }
      ],
      vatType: 'NONE' as const, 
      currency: NODE_ENV === 'production' ? 'ILS' : 'USD',
      remarks: `Subscription ID: ${subscriptionData.subscriptionId}`,
      lang: 'he',
      paymentType: 3 
    };

    const invoiceResponse = await createInvoice(invoiceData);

    const subscriptionDetailsWithInvoice = {
      ...subscriptionData,
      invoiceUrl: invoiceResponse.url.he
    };

    // Send confirmation email
    await sendSubscriptionConfirmation(email, subscriptionDetailsWithInvoice, 'payment');

    res.status(200).json({ 
      message: 'Subscription confirmation email sent successfully',
      invoice: invoiceResponse
    });
  } catch (error) {
    console.error('Error sending subscription confirmation:', error);
    res.status(500).json({ error: 'Failed to send subscription confirmation' });
  }
});

router.post('/send-order-confirmation', async (req, res) => {
  try {
    const { email, orderData } = req.body;

    if (!email || !orderData) {
      return res.status(400).json({ error: 'Email and order details are required' });
    }
    
    const formattedOrderDetails = formatOrderDetails(orderData);
    let invoiceData = formatInvoiceData(orderData);
    
    // Calculate base prices first
    invoiceData = {
      ...invoiceData,
      income: invoiceData.income.map(item => ({
        ...item,
        price: parseFloat((item.price / 1.12).toFixed(2))
      })),
    };

    // Calculate subtotal of base prices
    const subtotal = invoiceData.income.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Calculate platform fee based on base prices
    const platformFee = parseFloat((subtotal * 0.12).toFixed(2));

    // Add platform fee as final line item
    invoiceData.income.push({
      description: '(12%) Platform Fee',
      quantity: 1,
      price: platformFee
    });

    invoiceData.remarks = `Order ID: ${orderData.id}`;
    
    const invoiceResponse = await createInvoice(invoiceData);
    
    const orderDetailsWithInvoice = {
      ...formattedOrderDetails,
      invoiceUrl: invoiceResponse.url.he  
    };

     const orderConfirmationData = await sendOrderConfirmation(email, orderDetailsWithInvoice)   
    
    res.status(200).json({ 
      message: 'Order confirmation email sent successfully',
      invoice: invoiceResponse,
      orderConfirmationData
    });
  } catch (error) {
    console.error('Error sending order confirmation:', error);
    res.status(500).json({ error: 'Failed to send order confirmation' });
  }
});

router.post('/send-payout-notification', async (req, res) => {
  try {
    const { sellerId , amount, orderId } = req.body;
    
    
    if (!sellerId || !amount ||!orderId ) {
      return res.status(400).json({ error: 'SellerId, orderId and amount are required' });
    }
    
    const fees = calculateMarketplaceFee(amount);

    const payoutInvoice = await createPayoutInvoice(
      {
        id: orderId,
        amount
      },
      fees,
      sellerId
    );

    await sendPayoutNotification(sellerId, fees.sellerAmount,orderId,payoutInvoice.url.he);
    res.status(200).json({ message: 'Payout notification email sent successfully' });
  } catch (error) {
    console.error('Error sending payout notification:', error);
    res.status(500).json({ error: 'Failed to send payout notification email' });
  }
});
router.post('/send-password-reset', async (req, res) => {
  try {
    const { email, resetToken } = req.body;

    if (!email || !resetToken) {
      return res.status(400).json({ error: 'Email and reset token are required' });
    }

    await sendPasswordReset(email, resetToken);
    res.status(200).json({ message: 'Password reset email sent successfully' });
  } catch (error) {
    console.error('Error sending password reset:', error);
    res.status(500).json({ error: 'Failed to send password reset email' });
  }
});

// ===========================================
// Email Verification
// ===========================================
router.post('/send-email-verification', async (req, res) => {
  try {
    const { email, name, verificationToken } = req.body;

    if (!email || !name || !verificationToken) {
      return res.status(400).json({ error: 'Email, name, and verification token are required' });
    }

    await sendEmailVerification(email, name, verificationToken);
    res.status(200).json({ message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('Error sending verification email:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// ===========================================
// Account Deactivation
// ===========================================
router.post('/send-account-deactivation', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }

    await sendAccountDeactivation(email, name);
    res.status(200).json({ message: 'Account deactivation email sent successfully' });
  } catch (error) {
    console.error('Error sending account deactivation email:', error);
    res.status(500).json({ error: 'Failed to send account deactivation email' });
  }
});

// ===========================================
// Refund Confirmation
// ===========================================
router.post('/send-refund-confirmation', async (req, res) => {
  try {
    const { email, customerName, refundAmount, orderId, reason } = req.body;

    if (!email || !customerName || !refundAmount || !orderId) {
      return res.status(400).json({ error: 'Email, customer name, refund amount, and order ID are required' });
    }

    await sendRefundConfirmation(email, customerName, refundAmount, orderId, reason);
    res.status(200).json({ message: 'Refund confirmation email sent successfully' });
  } catch (error) {
    console.error('Error sending refund confirmation:', error);
    res.status(500).json({ error: 'Failed to send refund confirmation email' });
  }
});

// ===========================================
// Order Cancelled
// ===========================================
router.post('/send-order-cancelled', async (req, res) => {
  try {
    const { email, customerName, orderId, studioName, refundAmount } = req.body;

    if (!email || !customerName || !orderId || !studioName) {
      return res.status(400).json({ error: 'Email, customer name, order ID, and studio name are required' });
    }

    await sendOrderCancelled(email, customerName, orderId, studioName, refundAmount);
    res.status(200).json({ message: 'Order cancelled email sent successfully' });
  } catch (error) {
    console.error('Error sending order cancelled email:', error);
    res.status(500).json({ error: 'Failed to send order cancelled email' });
  }
});

// ===========================================
// Booking Emails
// ===========================================
router.post('/send-new-booking-vendor', async (req, res) => {
  try {
    const { ownerEmail, ownerName, booking } = req.body;

    if (!ownerEmail || !ownerName || !booking) {
      return res.status(400).json({ error: 'Owner email, owner name, and booking details are required' });
    }

    await sendNewBookingVendor(ownerEmail, ownerName, booking);
    res.status(200).json({ message: 'New booking notification sent to vendor successfully' });
  } catch (error) {
    console.error('Error sending new booking vendor email:', error);
    res.status(500).json({ error: 'Failed to send new booking notification to vendor' });
  }
});

router.post('/send-booking-confirmed-customer', async (req, res) => {
  try {
    const { customerEmail, booking } = req.body;

    if (!customerEmail || !booking) {
      return res.status(400).json({ error: 'Customer email and booking details are required' });
    }

    await sendBookingConfirmedCustomer(customerEmail, booking);
    res.status(200).json({ message: 'Booking confirmation sent to customer successfully' });
  } catch (error) {
    console.error('Error sending booking confirmation:', error);
    res.status(500).json({ error: 'Failed to send booking confirmation to customer' });
  }
});

router.post('/send-booking-reminder', async (req, res) => {
  try {
    const { customerEmail, booking, hoursUntil } = req.body;

    if (!customerEmail || !booking) {
      return res.status(400).json({ error: 'Customer email and booking details are required' });
    }

    await sendBookingReminder(customerEmail, booking, hoursUntil || 24);
    res.status(200).json({ message: 'Booking reminder sent successfully' });
  } catch (error) {
    console.error('Error sending booking reminder:', error);
    res.status(500).json({ error: 'Failed to send booking reminder' });
  }
});

router.post('/send-booking-cancelled-customer', async (req, res) => {
  try {
    const { customerEmail, customerName, booking, refundAmount, reason } = req.body;

    if (!customerEmail || !customerName || !booking) {
      return res.status(400).json({ error: 'Customer email, customer name, and booking details are required' });
    }

    await sendBookingCancelledCustomer(customerEmail, customerName, booking, refundAmount, reason);
    res.status(200).json({ message: 'Booking cancellation sent to customer successfully' });
  } catch (error) {
    console.error('Error sending booking cancellation to customer:', error);
    res.status(500).json({ error: 'Failed to send booking cancellation to customer' });
  }
});

router.post('/send-booking-cancelled-vendor', async (req, res) => {
  try {
    const { ownerEmail, ownerName, booking, cancelledBy } = req.body;

    if (!ownerEmail || !ownerName || !booking) {
      return res.status(400).json({ error: 'Owner email, owner name, and booking details are required' });
    }

    await sendBookingCancelledVendor(ownerEmail, ownerName, booking, cancelledBy || 'customer');
    res.status(200).json({ message: 'Booking cancellation sent to vendor successfully' });
  } catch (error) {
    console.error('Error sending booking cancellation to vendor:', error);
    res.status(500).json({ error: 'Failed to send booking cancellation to vendor' });
  }
});

router.post('/send-booking-modified', async (req, res) => {
  try {
    const { customerEmail, customerName, booking, changes } = req.body;

    if (!customerEmail || !customerName || !booking || !changes) {
      return res.status(400).json({ error: 'Customer email, customer name, booking details, and changes description are required' });
    }

    await sendBookingModified(customerEmail, customerName, booking, changes);
    res.status(200).json({ message: 'Booking modification notification sent successfully' });
  } catch (error) {
    console.error('Error sending booking modification:', error);
    res.status(500).json({ error: 'Failed to send booking modification notification' });
  }
});

// ===========================================
// Review Request
// ===========================================
router.post('/send-review-request', async (req, res) => {
  try {
    const { customerEmail, customerName, studioName, studioId, bookingId } = req.body;

    if (!customerEmail || !customerName || !studioName || !studioId || !bookingId) {
      return res.status(400).json({ error: 'Customer email, customer name, studio name, studio ID, and booking ID are required' });
    }

    await sendReviewRequest(customerEmail, customerName, studioName, studioId, bookingId);
    res.status(200).json({ message: 'Review request sent successfully' });
  } catch (error) {
    console.error('Error sending review request:', error);
    res.status(500).json({ error: 'Failed to send review request' });
  }
});

// ===========================================
// Trial Emails
// ===========================================
router.post('/send-trial-started', async (req, res) => {
  try {
    const { email, details } = req.body;

    if (!email || !details) {
      return res.status(400).json({ error: 'Email and trial details are required' });
    }

    await sendTrialStartedEmail(email, details);
    res.status(200).json({ message: 'Trial started email sent successfully' });
  } catch (error) {
    console.error('Error sending trial started email:', error);
    res.status(500).json({ error: 'Failed to send trial started email' });
  }
});

router.post('/send-trial-ending', async (req, res) => {
  try {
    const { email, details } = req.body;

    if (!email || !details) {
      return res.status(400).json({ error: 'Email and trial details are required' });
    }

    await sendTrialEndingEmail(email, details);
    res.status(200).json({ message: 'Trial ending reminder sent successfully' });
  } catch (error) {
    console.error('Error sending trial ending email:', error);
    res.status(500).json({ error: 'Failed to send trial ending reminder' });
  }
});

router.post('/send-trial-charge-failed', async (req, res) => {
  try {
    const { email, details } = req.body;

    if (!email || !details) {
      return res.status(400).json({ error: 'Email and details are required' });
    }

    await sendTrialChargeFailedEmail(email, details);
    res.status(200).json({ message: 'Trial charge failed email sent successfully' });
  } catch (error) {
    console.error('Error sending trial charge failed email:', error);
    res.status(500).json({ error: 'Failed to send trial charge failed email' });
  }
});

// ===========================================
// Subscription Status Emails
// ===========================================
router.post('/send-subscription-payment-failed', async (req, res) => {
  try {
    const { email, details } = req.body;

    if (!email || !details) {
      return res.status(400).json({ error: 'Email and details are required' });
    }

    await sendSubscriptionPaymentFailed(email, details);
    res.status(200).json({ message: 'Subscription payment failed email sent successfully' });
  } catch (error) {
    console.error('Error sending subscription payment failed email:', error);
    res.status(500).json({ error: 'Failed to send subscription payment failed email' });
  }
});

router.post('/send-subscription-expiring', async (req, res) => {
  try {
    const { email, details } = req.body;

    if (!email || !details) {
      return res.status(400).json({ error: 'Email and details are required' });
    }

    await sendSubscriptionExpiring(email, details);
    res.status(200).json({ message: 'Subscription expiring reminder sent successfully' });
  } catch (error) {
    console.error('Error sending subscription expiring email:', error);
    res.status(500).json({ error: 'Failed to send subscription expiring reminder' });
  }
});

router.post('/send-subscription-upgraded', async (req, res) => {
  try {
    const { email, details } = req.body;

    if (!email || !details) {
      return res.status(400).json({ error: 'Email and details are required' });
    }

    await sendSubscriptionUpgraded(email, details);
    res.status(200).json({ message: 'Subscription upgraded email sent successfully' });
  } catch (error) {
    console.error('Error sending subscription upgraded email:', error);
    res.status(500).json({ error: 'Failed to send subscription upgraded email' });
  }
});

router.post('/send-subscription-downgraded', async (req, res) => {
  try {
    const { email, details } = req.body;

    if (!email || !details) {
      return res.status(400).json({ error: 'Email and details are required' });
    }

    await sendSubscriptionDowngraded(email, details);
    res.status(200).json({ message: 'Subscription downgraded email sent successfully' });
  } catch (error) {
    console.error('Error sending subscription downgraded email:', error);
    res.status(500).json({ error: 'Failed to send subscription downgraded email' });
  }
});

// ===========================================
// Send Test Email (Admin only)
// ===========================================
router.post('/send-test', async (req, res) => {
  try {
    const { email, templateType } = req.body;

    if (!email || !templateType) {
      return res.status(400).json({ error: 'Email and template type are required' });
    }

    // Get the template ID from the type
    const templateId = BREVO_TEMPLATE_IDS[templateType as keyof typeof BREVO_TEMPLATE_IDS];

    if (!templateId) {
      return res.status(400).json({ error: `Invalid template type: ${templateType}` });
    }

    // Generate sample data based on template type
    const sampleParams = generateSampleParams(templateType);

    await sendTemplateEmail({
      to: [{ email, name: 'Admin Test' }],
      templateId,
      params: sampleParams
    });

    res.status(200).json({
      message: `Test email sent successfully to ${email}`,
      templateType,
      templateId
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Helper function to generate sample params for test emails
function generateSampleParams(templateType: string): Record<string, any> {
  const baseParams = {
    customerName: 'לקוח לדוגמה',
    ownerName: 'בעל סטודיו לדוגמה',
    studioName: 'סטודיו הקלטות מדהים',
    experienceName: 'הקלטת שיר',
    serviceName: 'הקלטת שיר',
    planName: 'מקצוען',
    price: '199',
    totalPaid: '₪199',
    dateTime: '15 בינואר 2025, 14:00',
    duration: '2 שעות',
    location: 'תל אביב, רחוב דיזנגוף 50',
    reservationId: 'RES-TEST-123',
    bookingId: 'BOOK-TEST-123',
    orderId: 'ORD-TEST-123',
    orderNumber: 'ORD-TEST-123',
    subscriptionId: 'SUB-TEST-123',
    invoiceUrl: 'https://studioz.co.il/invoice/test',
    documentUrl: 'https://studioz.co.il/document/test',
    documentName: 'חשבונית מס',
    documentNumber: '1234',
    actionUrl: 'https://studioz.co.il',
    bookingUrl: 'https://studioz.co.il/reservations/test',
    orderUrl: 'https://studioz.co.il/orders/test',
    payoutUrl: 'https://studioz.co.il/dashboard/payouts',
    refundUrl: 'https://studioz.co.il/orders/test',
    reviewUrl: 'https://studioz.co.il/studio/test/review',
    resetLink: 'https://studioz.co.il/reset-password?token=test',
    verificationLink: 'https://studioz.co.il/verify-email?token=test',
    verificationCode: 'ABC123',
    notes: 'הערות לדוגמה',
    guestEmail: 'guest@example.com',
    guestPhone: '050-1234567',
    startDate: '1 בינואר 2025',
    nextBillingDate: '1 בפברואר 2025',
    trialEndDate: '14 בינואר 2025',
    trialDays: 14,
    daysRemaining: 3,
    payoutAmount: '₪150',
    payoutDate: '15 בינואר 2025',
    refundAmount: '₪199',
    refundDate: '15 בינואר 2025',
    cancellationDate: '15 בינואר 2025',
    deactivationDate: '15 בינואר 2025',
    accessEndDate: '31 בינואר 2025',
    effectiveDate: '1 בפברואר 2025',
    oldPlanName: 'בסיסי',
    newPlanName: 'מקצוען',
    failureReason: 'פרטי כרטיס לא מעודכנים',
    reason: 'לפי בקשת הלקוח',
    changes: 'שעת ההזמנה שונתה מ-14:00 ל-16:00',
    cancelledBy: 'הלקוח',
    hoursUntil: 24
  };

  return baseParams;
}

// Get all Brevo email templates (admin only)
router.get('/templates', async (req, res) => {
  try {
    const { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } = await import('@getbrevo/brevo');
    const apiKey = process.env.BREVO_EMAIL_API_KEY as string;
    const apiInstance = new TransactionalEmailsApi();
    apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);

    // Fetch templates from Brevo - getSmtpTemplates(templateStatus?, limit?, offset?, sort?)
    const response = await apiInstance.getSmtpTemplates(true, 100, 0);

    // Map templates to a cleaner format
    const templates = (response.body.templates || []).map((template: any) => ({
      id: template.id,
      name: template.name,
      subject: template.subject,
      isActive: template.isActive,
      createdAt: template.createdAt,
      modifiedAt: template.modifiedAt,
      htmlContent: template.htmlContent,
      sender: template.sender,
      replyTo: template.replyTo,
      toField: template.toField,
      tag: template.tag
    }));

    res.status(200).json({
      templates,
      count: response.body.count || templates.length
    });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

// Get a single Brevo template by ID
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const templateId = parseInt(id, 10);

    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } = await import('@getbrevo/brevo');
    const apiKey = process.env.BREVO_EMAIL_API_KEY as string;
    const apiInstance = new TransactionalEmailsApi();
    apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);

    const response = await apiInstance.getSmtpTemplate(templateId);

    res.status(200).json({
      id: response.body.id,
      name: response.body.name,
      subject: response.body.subject,
      isActive: response.body.isActive,
      htmlContent: response.body.htmlContent,
      createdAt: response.body.createdAt,
      modifiedAt: response.body.modifiedAt,
      sender: response.body.sender,
      replyTo: response.body.replyTo,
      toField: response.body.toField,
      tag: response.body.tag
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

router.post('/send-document', async (req, res) => {
  try {
    const { email, customerName, documentName, documentUrl, documentNumber } = req.body;

    if (!email || !documentUrl) {
      return res.status(400).json({ error: 'Email and document URL are required' });
    }

    await sendDocumentEmail(
      email,
      customerName || 'לקוח יקר',
      documentName || 'מסמך',
      documentUrl,
      documentNumber
    );

    res.status(200).json({ message: 'Document email sent successfully' });
  } catch (error) {
    console.error('Error sending document email:', error);
    res.status(500).json({ error: 'Failed to send document email' });
  }
});

router.use(emailLimiter);

export default router;