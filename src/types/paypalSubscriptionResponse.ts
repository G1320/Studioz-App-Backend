// src/types/paypal.ts
export interface PayPalSubscriptionResponse {
    id: string;
    status: 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
    status_update_time: string;
    plan_id: string;
    start_time: string;
    quantity: string;
    subscriber: {
      email_address: string;
      payer_id: string;
      name: {
        given_name: string;
        surname: string;
      };
    };
    billing_info: {
      outstanding_balance: {
        currency_code: string;
        value: string;
      };
      cycle_executions: Array<{
        tenure_type: string;
        sequence: number;
        cycles_completed: number;
        cycles_remaining: number;
        current_pricing_scheme_version: number;
      }>;
      last_payment: {
        amount: {
          currency_code: string;
          value: string;
        };
        time: string;
      };
      next_billing_time: string;
      final_payment_time: string;
      failed_payments_count: number;
    };
    create_time: string;
    update_time: string;
    links: Array<{
      href: string;
      rel: string;
      method: string;
    }>;
  };