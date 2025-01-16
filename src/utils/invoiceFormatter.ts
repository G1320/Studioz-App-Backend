// utils/invoiceFormatter.ts
import { CreateInvoiceData } from '../api/handlers/invoiceHandler.js';
import { NODE_ENV } from '../config/index.js';

interface PayPalAddress {
  address_line_1?: string;
  admin_area_2?: string; // City
  postal_code?: string;
  country_code?: string;
}

interface PayPalShipping {
  address: PayPalAddress;
}

interface PayPalPayer {
  name: {
    given_name: string;
    surname: string;
  };
  email_address: string;
}

interface PayPalItem {
  name: string;
  quantity: string;
  unit_amount: {
    value: string;
  };
}

interface PayPalPaymentSource {
    paypal?: {
      account_id: string;
    };
    card?: {
      brand: string;
      type: string;
    };
  }
  
  interface PayPalOrderData {
    id: string;
    payer: PayPalPayer;
    payment_source: PayPalPaymentSource;
    purchase_units: Array<{
      shipping?: PayPalShipping;
      items?: PayPalItem[];
    }>;
  }

  const currency = NODE_ENV === 'production' ? 'ILS' : 'USD';


export const formatAddress = (shipping?: PayPalShipping): string => {
  if (!shipping?.address) return '';

  const { address_line_1, admin_area_2, postal_code, country_code } = shipping.address;
  const parts = [
    address_line_1,
    admin_area_2,
    postal_code,
    country_code
  ].filter(Boolean);

  return parts.join(', ');
};

export const formatClient = (payer: PayPalPayer, shipping?: PayPalShipping) => {
  return {
    name: `${payer.name.given_name} ${payer.name.surname}`,
    email: payer.email_address,
    address: formatAddress(shipping)
  };
};

export const formatIncomeItems = (items: PayPalItem[] = []) => {
  return items.map(item => ({
    description: item.name,
    quantity: parseInt(item.quantity),
    price: parseFloat(item.unit_amount.value)
  }));
};

export const formatInvoiceData = (orderData: PayPalOrderData): CreateInvoiceData => {
    const { payer, purchase_units } = orderData;
    const shipping = purchase_units[0]?.shipping;
    const items = purchase_units[0]?.items || [];
  
    return {
      type: 300,  // Code for Invoice + Receipt (חשבונית מס קבלה)
      client: formatClient(payer, shipping),
      income: formatIncomeItems(items),
      vatType: 'NONE',
      currency: currency,
      remarks: `Order ID: ${orderData.id}`,
      lang: 'he', 
      paymentType: getPaymentType(orderData)
    };
  };

  export const getPaymentType = (orderData: PayPalOrderData): number => {
    // Check if payment was made via PayPal balance or PayPal Credit
    if (orderData.payment_source?.paypal) {
      return 5; // Other (for PayPal balance)
    }
    
    // Check if payment was made via credit card through PayPal
    if (orderData.payment_source?.card) {
      return 3; // Credit Card
    }
  
    // Default to Other if payment source is unclear
    return 5;
  };

  // utils/subscriptionInvoiceFormatter.ts
export const formatSubscriptionInvoiceData = (subscriptionData: any, user: any) => {
  const basePrice = parseFloat((subscriptionData.planPrice / 1.12).toFixed(2));
  const platformFee = parseFloat((basePrice * 0.12).toFixed(2));

  return {
    type: 300, // Code for Invoice + Receipt
    client: {
      name: user.name,
      email: user.email,
      address: subscriptionData.paypalDetails?.shipping_address || ''
    },
    income: [
      {
        description: `${subscriptionData.planName} Subscription`,
        quantity: 1,
        price: basePrice
      },
      {
        description: '(12%) Platform Fee',
        quantity: 1,
        price: platformFee
      }
    ],
    vatType: 'NONE',
    currency: 'ILS',
    remarks: `Subscription ID: ${subscriptionData.subscriptionId}`,
    lang: 'he',
    paymentType: 3 // Credit Card
  };
};