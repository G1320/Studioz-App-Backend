import express from 'express';
import { sendWelcomeEmail, sendOrderConfirmation, sendPasswordReset, sendPayoutNotification, sendSubscriptionConfirmation } from '../handlers/emailHandler.js';
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
    await sendSubscriptionConfirmation(email, subscriptionDetailsWithInvoice, 'activation');

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

router.use(emailLimiter);

export default router;