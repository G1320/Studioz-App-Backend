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



export const sendTemplateEmail = async ({ to, templateId, params }: EmailParams) => {
  try {
    const response = await apiInstance.sendTransacEmail({
      to,
      templateId,
      params
    });
    
    console.log('Email sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Example usage for different email types
export const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  return sendTemplateEmail({
    to: [{ email: userEmail, name: userName }],
    templateId: 3, // Your welcome email template ID
    params: {
      name: userName,
      // Add other template variables
    }
  });
};

export const sendOrderConfirmation = async (userEmail: string, orderDetails: any) => {

  return sendTemplateEmail({
    to: [{ email: userEmail }],
    templateId: 1, // Your order confirmation template ID
    params: {
      orderNumber: orderDetails.id,
      items: orderDetails.items,
      total: orderDetails.total,
      // Add other template variables
    }
  });
};

export const sendPasswordReset = async (userEmail: string, resetToken: string) => {
  return sendTemplateEmail({
    to: [{ email: userEmail }],
    templateId: 4, // Your password reset template ID
    params: {
      resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
      // Add other template variables
    }
  });
};