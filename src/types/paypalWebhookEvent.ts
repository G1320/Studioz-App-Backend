export interface PayPalWebhookEvent {
    event_type: string;
    resource: {
      id: string;
      status?: string;
      amount?: {
        value: string;
        currency: string;
      };
      billing_agreement_id?: string;
      [key: string]: any;
    };
    [key: string]: any;
  }