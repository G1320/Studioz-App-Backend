export interface OTPRecord {
    code: string;
    phoneNumber: string;
    expiresAt: Date;
    verified: boolean;
    attempts: number;
  }