// services/invoiceService.ts
import axios, { AxiosInstance } from 'axios';

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
}

export interface InvoiceResponse {
  id: string;
  status: string;
  total: number;
  issuedDate: string;
  [key: string]: any;
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
  // if (cachedToken && tokenExpiration && Date.now() < tokenExpiration) {
  //   return cachedToken; // Return cached token if valid
  // }

  console.log('GREEN_INVOICE_API_URL: ', GREEN_INVOICE_API_URL);
  console.log('GREEN_INVOICE_API_KEY: ', GREEN_INVOICE_API_KEY);
  console.log('GREEN_INVOICE_API_SECRET: ', GREEN_INVOICE_API_SECRET);
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
    console.log('token: ', token);
    console.log('expires: ', expires);

    // Cache the token and set expiration
    cachedToken = token;
    tokenExpiration = Date.now() + expires * 1000;

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
