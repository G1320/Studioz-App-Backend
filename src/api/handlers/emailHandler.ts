// services/emailService.ts
import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';
import { UserModel } from '../../models/userModel.js';
import { getSellerDetails } from '../../utils/payoutUtils.js';

const apiKey = process.env.BREVO_EMAIL_API_KEY as string;
const apiInstance = new TransactionalEmailsApi();
apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);

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

export const sendSubscriptionConfirmation = async (userEmail: string, details: SubscriptionDetails) => {
  // Convert startDate to Date object if it's a string
  const startDate = typeof details.startDate === 'string' 
    ? new Date(details.startDate)
    : details.startDate;

  // Calculate next billing date
  const nextBillingDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  return sendTemplateEmail({
    to: [{ 
      email: userEmail,
      name: details.customerName 
    }],
    templateId: 8,
    params: {
      customerName: details.customerName,
      planName: details.planName,
      amount: details.planPrice.toFixed(2),
      subscriptionId: details.subscriptionId,
      startDate: startDate.toLocaleDateString('he-IL'),
      nextBillingDate: nextBillingDate.toLocaleDateString('he-IL'),
      invoiceUrl: details.invoiceUrl
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

