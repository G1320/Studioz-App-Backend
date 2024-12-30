// services/emailService.ts
import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

const apiKey = process.env.BREVO_API_KEY as string;
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

export const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: userName }],
    templateId: 3, 
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
      total: orderDetails.total        
    }
  });
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