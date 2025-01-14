import { TransactionalSMSApi, TransactionalSMSApiApiKeys } from '@getbrevo/brevo';
import { SendTransacSms } from '@getbrevo/brevo'

const apiKey = process.env.BREVO_SMS_API_KEY as string;
const apiInstance = new TransactionalSMSApi();
apiInstance.setApiKey(TransactionalSMSApiApiKeys.apiKey, apiKey);

interface BookingDetails {
  id: string;
  customerName: string;
  bookingDate: string;
  serviceName: string;
  startTime: string;
  location?: string;
}

interface SMSParams {
    phoneNumber: string;
    message: string;
    sender?: string;
    type?: SendTransacSms.TypeEnum; 
  }
  
  export const sendSMS = async ({ 
    phoneNumber, 
    message, 
    sender = "Studioz",
    type = SendTransacSms.TypeEnum.Transactional  
  }: SMSParams) => {
    try {
      const formattedPhone = formatIsraeliPhone(phoneNumber);
      
      const response = await apiInstance.sendTransacSms({
        sender,
        recipient: formattedPhone,
        content: message,
        type
      });
      
      return response;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  };

export const sendBookingConfirmation = async (phoneNumber: string, booking: BookingDetails) => {
  const message = `שלום ${booking.customerName}!
ההזמנה שלך אושרה:
${booking.serviceName}
תאריך: ${booking.bookingDate}
שעה: ${booking.startTime}
${booking.location ? `מיקום: ${booking.location}` : ''}
מספר הזמנה: ${booking.id}

תודה שבחרת בנו!
סטודיוZ`;

  return sendSMS({
    phoneNumber,
    message,
  });
};

// Helper function to format Israeli phone numbers
const formatIsraeliPhone = (phone: string): string => {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If number starts with 0, replace with +972
  if (cleaned.startsWith('0')) {
    cleaned = '972' + cleaned.substring(1);
  }
  
  // If number doesn't have country code, add it
  if (!cleaned.startsWith('972')) {
    cleaned = '972' + cleaned;
  }
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
};