// services/invoiceService.ts
import axios, { AxiosInstance } from 'axios';
import { formatAddress, getPaymentType } from '../../utils/invoiceFormatter.js';

const { GREEN_INVOICE_API_URL, GREEN_INVOICE_API_KEY, GREEN_INVOICE_API_SECRET } = process.env;

interface TokenResponse {
  token: string;
  expires: number;
}

let cachedToken: string | null = null;
let tokenExpiration: number | null = null;

export interface Client {
  name: string;
  email: string;
  address?: string;
  phone?: string;
}

export interface IncomeItem {
  description: string;
  quantity: number;
  price: number;
}

export interface CreateInvoiceData {
  type: number;      
  client: {
    name: string;
    email: string;
    address?: string;
    phone?: string;
  };
  income: {
    description: string;
    quantity: number;
    price: number;
  }[];
  vatType: 'INCLUDED' | 'EXCLUDED' | 'NONE';
  currency: 'ILS' | 'USD' | 'EUR';
  remarks?: string;
  lang?: 'he' | 'en';  
  paymentType?: number; 
}

export interface InvoiceResponse {
  id: string;
  status: string;
  total: number;
  issuedDate: string;
  [key: string]: any;
}

interface MarketplaceFees {
  platformFee: number; 
  sellerAmount: number; 
  // total: number;       
}

const apiClient: AxiosInstance = axios.create({
  baseURL: GREEN_INVOICE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await fetchToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});



export const fetchToken = async (): Promise<string> => {
 
  try {
    const response = await axios.post<TokenResponse>(
      `${GREEN_INVOICE_API_URL}/account/token`,
      {
        id: GREEN_INVOICE_API_KEY,
        secret: GREEN_INVOICE_API_SECRET,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
      );
      
    const { token, expires } = response.data;
 
    return token;
  } catch (error: any) {
    console.error('Error fetching token:', error.response?.data || error.message);
    throw new Error('Failed to retrieve authorization token');
  }
};

export const createInvoice = async (data: CreateInvoiceData): Promise<InvoiceResponse> => {
  try {
    const response = await apiClient.post<InvoiceResponse>('/documents', data);
    return response.data;
  } catch (error: any) {
    console.error('Error creating invoice:', error.response?.data || error.message);
    throw new Error('Failed to create invoice');
  }
};

export const getInvoice = async (invoiceId: string): Promise<InvoiceResponse> => {
  try {
    const response = await apiClient.get<InvoiceResponse>(`/documents/${invoiceId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error retrieving invoice:', error.response?.data || error.message);
    throw new Error('Failed to retrieve invoice');
  }
};


export const createPayoutInvoice = async (
  orderData: any, 
  fees: MarketplaceFees,
  sellerId: string
) => {
 
  // const amount = parseFloat(fees.sellerAmount.toFixed(2));

  const amount = Number(fees.sellerAmount);


  // 2. Create seller payout invoice (expense for you)
  const sellerInvoice = await createInvoice({
    type: 300, 
    lang: 'he', 

    client: {
      name: 'Studioz', 
      email: 'admin@studioz.online',
      address: 'Allenby 70, Tel-aviv, Israel'
    },
    income: [{
      description: `Payout for Order ${orderData.id}`,
      quantity: 1,
      price: Number(amount.toFixed(2))
    }],
    vatType: 'INCLUDED',
    currency: 'ILS',
    remarks: `Seller ID: ${sellerId}`,
    paymentType: 5 
  });

  return sellerInvoice
  
};