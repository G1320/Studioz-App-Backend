export default interface Payout {
    sellerId: string;
    amount: number;
    orderId: string;
    payoutId: string;
    status: string;
    timestamp: Date;
    invoiceId?: string;
  }