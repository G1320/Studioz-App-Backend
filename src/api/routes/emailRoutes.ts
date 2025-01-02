import express from 'express';
import { sendWelcomeEmail, sendOrderConfirmation, sendPasswordReset, sendPayoutNotification } from '../handlers/emailHandler.js';
// import { authenticateUser } from '../middleware/auth'; // Assuming you have auth middleware

import { formatOrderDetails } from '../../utils/orderFormatter.js';
import { formatInvoiceData } from '../../utils/invoiceFormatter.js';

import rateLimit from 'express-rate-limit';
import { createInvoice } from '../handlers/invoiceHandler.js';

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

      await sendOrderConfirmation(email, orderDetailsWithInvoice),    
    
    res.status(200).json({ 
      message: 'Order confirmation email sent successfully',
      invoice: invoiceResponse
    });
  } catch (error) {
    console.error('Error sending order confirmation:', error);
    res.status(500).json({ error: 'Failed to send order confirmation' });
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

router.use(emailLimiter);

export default router;