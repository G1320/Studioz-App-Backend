// controllers/ordersController.js
import { OrdersController, ApiError } from '@paypal/paypal-server-sdk';
import { paypalClient } from '../../config/paypalClientConfig.js';

const ordersController = new OrdersController(paypalClient);

export const createOrder = async (cart) => {
  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    throw new Error('Cart is empty or invalid.');
  }
  console.log('Validated cart: ', cart);
  const collect = {
    body: {
      intent: 'CAPTURE',
      purchaseUnits: [
        {
          amount: {
            currencyCode: 'USD',
            value: '100'
          }
        }
      ]
    },
    prefer: 'return=minimal'
  };

  try {
    const { body, ...httpResponse } = await ordersController.ordersCreate(collect);
    return {
      jsonResponse: JSON.parse(body),
      httpStatusCode: httpResponse.statusCode
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(error.message);
    }
    throw error;
  }
};

export const captureOrder = async (orderID) => {
  const collect = {
    id: orderID,
    prefer: 'return=minimal'
  };

  try {
    const { body, ...httpResponse } = await ordersController.ordersCapture(collect);
    return {
      jsonResponse: JSON.parse(body),
      httpStatusCode: httpResponse.statusCode
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(error.message);
    }
    throw error;
  }
};

export const refundCapturedPayment = async (capturedPaymentId) => {
  const collect = {
    captureId: capturedPaymentId,
    prefer: 'return=minimal'
  };

  try {
    const { body, ...httpResponse } = await paymentsController.capturesRefund(collect);
    // Get more response info...
    // const { statusCode, headers } = httpResponse;
    return {
      jsonResponse: JSON.parse(body),
      httpStatusCode: httpResponse.statusCode
    };
  } catch (error) {
    if (error instanceof ApiError) {
      // const { statusCode, headers } = error;
      throw new Error(error.message);
    }
  }
};
