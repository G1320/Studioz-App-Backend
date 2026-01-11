import axios from 'axios';
import { UserModel } from '../models/userModel.js';
import { ItemModel } from '../models/itemModel.js';

const SUMIT_API_URL = 'https://api.sumit.co.il';

// Platform (marketplace) credentials
const PLATFORM_COMPANY_ID = process.env.SUMIT_COMPANY_ID;
const PLATFORM_API_KEY = process.env.SUMIT_API_KEY;

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
}

interface SaveCardResult {
  success: boolean;
  customerId?: string;
  creditCardToken?: string;
  lastFourDigits?: string;
  error?: string;
}

interface ChargeResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

interface VendorCredentials {
  companyId: string;
  apiKey: string;
  vendorId: string;
}

/**
 * Payment service for reservation-related payments
 * Handles saving cards for later charge and charging saved cards
 */
export const paymentService = {
  /**
   * Get vendor's Sumit credentials
   * Returns null if vendor doesn't have payment set up
   */
  async getVendorCredentials(vendorId: string): Promise<VendorCredentials | null> {
    const vendor = await UserModel.findById(vendorId);
    
    if (!vendor?.sumitCompanyId || !vendor?.sumitApiKey) {
      return null;
    }

    return {
      companyId: vendor.sumitCompanyId.toString(),
      apiKey: vendor.sumitApiKey,
      vendorId: vendor._id.toString()
    };
  },

  /**
   * Save a customer's card at PLATFORM level for future charging
   * Uses /billing/paymentmethods/setforcustomer/ with PLATFORM credentials
   * Card works across all vendors via multivendorcharge
   * See: https://help.sumit.co.il/he/articles/5832819
   */
  async saveCardForLaterCharge(
    singleUseToken: string,
    customerInfo: CustomerInfo,
    _credentials: VendorCredentials // Not used - we use platform credentials
  ): Promise<SaveCardResult> {
    try {
      console.log('[Payment Debug] Saving card at platform level via setforcustomer:', {
        token: singleUseToken ? `${singleUseToken.substring(0, 8)}...` : 'MISSING',
        customerName: customerInfo.name,
        platformCompanyId: PLATFORM_COMPANY_ID
      });
      
      // Use setforcustomer with PLATFORM credentials
      // This saves the card at platform level - works across all vendors
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/paymentmethods/setforcustomer/`,
        {
          SingleUseToken: singleUseToken,
          Customer: {
            Name: customerInfo.name || 'Customer',
            EmailAddress: customerInfo.email || '',
            Phone: customerInfo.phone || '',
            SearchMode: 0 // Automatic - creates new or finds existing by email
          },
          Credentials: {
            CompanyID: PLATFORM_COMPANY_ID,
            APIKey: PLATFORM_API_KEY
          }
        }
      );

      // Sumit response can be either { CustomerID, PaymentMethod } or { Data: { CustomerID, PaymentMethod } }
      const responseData = response.data?.Data || response.data;
      
      console.log('[Payment Debug] Sumit setforcustomer response:', {
        status: response.status,
        hasCustomerId: !!responseData?.CustomerID,
        hasPaymentMethod: !!responseData?.PaymentMethod,
        customerId: responseData?.CustomerID,
        lastDigits: responseData?.PaymentMethod?.CreditCard_LastDigits,
        error: response.data?.UserErrorMessage
      });

      // Response contains CustomerID and PaymentMethod with card details
      if (responseData?.CustomerID) {
        const paymentMethod = responseData.PaymentMethod;
        return {
          success: true,
          customerId: responseData.CustomerID.toString(),
          creditCardToken: paymentMethod?.CreditCard_Token,
          lastFourDigits: paymentMethod?.CreditCard_LastDigits
        };
      }

      return {
        success: false,
        error: response.data?.UserErrorMessage || 'Failed to save card'
      };
    } catch (error: any) {
      console.error('Save card error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Failed to save card'
      };
    }
  },

  /**
   * Charge a previously saved card
   * Uses multivendorcharge with saved customer ID
   * Platform credentials for the main call, vendor receives the payment
   */
  async chargeSavedCard(
    sumitCustomerId: string,
    amount: number,
    description: string,
    credentials: VendorCredentials
  ): Promise<ChargeResult> {
    try {
      console.log('[Payment Debug] Charging saved card via multivendorcharge:', {
        customerId: sumitCustomerId,
        amount,
        vendorCompanyId: credentials.companyId
      });

      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/multivendorcharge/`,
        {
          Customer: {
            ID: parseInt(sumitCustomerId),
            SearchMode: 1 // Search by ID
          },
          Items: [{
            Item: { 
              Name: description
            },
            Quantity: 1,
            UnitPrice: amount,
            Total: amount,
            Currency: 'ILS',
            Description: description,
            CompanyID: credentials.companyId,
            APIKey: credentials.apiKey
          }],
          VATIncluded: true,
          SendDocumentByEmail: true,
          DocumentLanguage: 'Hebrew',
          Credentials: {
            CompanyID: PLATFORM_COMPANY_ID,
            APIKey: PLATFORM_API_KEY
          }
        }
      );

      console.log('[Payment Debug] Charge response:', {
        validPayment: response.data?.Data?.Payment?.ValidPayment,
        paymentId: response.data?.Data?.Payment?.ID
      });

      if (response.data?.Data?.Payment?.ValidPayment) {
        return {
          success: true,
          paymentId: response.data.Data.Payment.ID
        };
      }

      return {
        success: false,
        error: response.data?.Data?.Payment?.StatusDescription || 'Payment failed'
      };
    } catch (error: any) {
      console.error('Charge error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Payment failed'
      };
    }
  },

  /**
   * Get saved payment methods for a customer from Sumit
   * Uses /billing/paymentmethods/getforcustomer/ endpoint
   * Returns the active payment method(s) for the customer
   */
  async getSavedPaymentMethods(sumitCustomerId: string): Promise<{
    success: boolean;
    paymentMethod?: {
      id: number;
      customerId: number;
      lastFourDigits: string;
      expirationMonth: number;
      expirationYear: number;
      cardMask: string;
      token: string;
    };
    error?: string;
  }> {
    try {
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/paymentmethods/getforcustomer/`,
        {
          Customer: {
            ID: parseInt(sumitCustomerId),
            SearchMode: 1 // Search by ID
          },
          IncludeInactive: false, // Only get active payment methods
          Credentials: {
            CompanyID: PLATFORM_COMPANY_ID,
            APIKey: PLATFORM_API_KEY
          }
        }
      );

      // Sumit response can be either { PaymentMethod } or { Data: { PaymentMethod } }
      const responseData = response.data?.Data || response.data;
      
      console.log('[Payment Debug] getSavedPaymentMethods response:', {
        hasPaymentMethod: !!responseData?.PaymentMethod,
        status: response.data?.Status,
        responseData
      });

      if (responseData?.PaymentMethod) {
        const pm = responseData.PaymentMethod;
        return {
          success: true,
          paymentMethod: {
            id: pm.ID,
            customerId: pm.CustomerID,
            lastFourDigits: pm.CreditCard_LastDigits,
            expirationMonth: pm.CreditCard_ExpirationMonth,
            expirationYear: pm.CreditCard_ExpirationYear,
            cardMask: pm.CreditCard_CardMask,
            token: pm.CreditCard_Token
          }
        };
      }

      return {
        success: false,
        error: response.data?.UserErrorMessage || 'No saved payment method found'
      };
    } catch (error: any) {
      console.error('Get payment methods error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Failed to get payment methods'
      };
    }
  },

  /**
   * Get saved payment methods by phone number (for non-logged-in users)
   * Uses /billing/paymentmethods/getforcustomer/ with SearchMode: 0 (Automatic)
   * Sumit will find customer by phone number
   */
  async getSavedPaymentMethodsByPhone(phone: string): Promise<{
    success: boolean;
    customerId?: string;
    paymentMethod?: {
      id: number;
      customerId: number;
      lastFourDigits: string;
      expirationMonth: number;
      expirationYear: number;
      cardMask: string;
    };
    error?: string;
  }> {
    try {
      console.log('[Payment Debug] Getting saved card by phone:', phone);
      
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/paymentmethods/getforcustomer/`,
        {
          Customer: {
            Phone: phone,
            SearchMode: 0 // Automatic - search by phone
          },
          IncludeInactive: false,
          Credentials: {
            CompanyID: PLATFORM_COMPANY_ID,
            APIKey: PLATFORM_API_KEY
          }
        }
      );

      const responseData = response.data?.Data || response.data;
      
      console.log('[Payment Debug] getSavedPaymentMethodsByPhone response:', {
        hasPaymentMethod: !!responseData?.PaymentMethod,
        customerId: responseData?.PaymentMethod?.CustomerID
      });

      if (responseData?.PaymentMethod) {
        const pm = responseData.PaymentMethod;
        return {
          success: true,
          customerId: pm.CustomerID?.toString(),
          paymentMethod: {
            id: pm.ID,
            customerId: pm.CustomerID,
            lastFourDigits: pm.CreditCard_LastDigits,
            expirationMonth: pm.CreditCard_ExpirationMonth,
            expirationYear: pm.CreditCard_ExpirationYear,
            cardMask: pm.CreditCard_CardMask
          }
        };
      }

      return {
        success: false,
        error: 'No saved card found for this phone number'
      };
    } catch (error: any) {
      console.error('Get payment by phone error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Failed to check for saved card'
      };
    }
  },

  /**
   * Handle payment for a new reservation
   * Saves card and optionally charges immediately (for instant book)
   * Also saves the card on the user for future use
   * 
   * @returns Updated payment fields to set on the reservation
   */
  async handleReservationPayment(params: {
    singleUseToken: string;
    customerInfo: CustomerInfo;
    vendorId: string;
    userId?: string; // User's ID to save card for future use
    amount: number;
    itemName: string;
    instantCharge: boolean;
  }): Promise<{
    paymentStatus: 'card_saved' | 'charged' | 'failed';
    paymentDetails: {
      sumitCustomerId: string;
      sumitCreditCardToken?: string;
      lastFourDigits?: string;
      amount: number;
      currency: string;
      sumitPaymentId?: string;
      chargedAt?: Date;
      failureReason?: string;
      vendorId: string;
    };
  } | null> {
    // Get vendor credentials
    const credentials = await this.getVendorCredentials(params.vendorId);
    
    if (!credentials) {
      // Vendor doesn't accept payments - return null (no payment attached)
      return null;
    }

    // Save the card
    const saveResult = await this.saveCardForLaterCharge(
      params.singleUseToken,
      params.customerInfo,
      credentials
    );

    if (!saveResult.success || !saveResult.customerId) {
      console.error('Failed to save card for reservation:', saveResult.error);
      // Return a failed status so the client knows what happened
      return {
        paymentStatus: 'failed' as const,
        paymentDetails: {
          sumitCustomerId: '',
          amount: params.amount,
          currency: 'ILS',
          vendorId: params.vendorId,
          failureReason: saveResult.error || 'Failed to save card'
        }
      };
    }

    // Save the Sumit customer ID on the user for future payments
    if (params.userId && saveResult.customerId) {
      try {
        await UserModel.findByIdAndUpdate(params.userId, {
          sumitCustomerId: saveResult.customerId,
          savedCardLastFour: saveResult.lastFourDigits,
          savedCardBrand: this.detectCardBrand(saveResult.lastFourDigits)
        });
      } catch (error) {
        console.error('Failed to save card info on user:', error);
        // Don't fail the payment, just log the error
      }
    }

    // Build payment details (customerId is guaranteed to exist here due to check above)
    const paymentDetails = {
      sumitCustomerId: saveResult.customerId as string,
      sumitCreditCardToken: saveResult.creditCardToken,
      lastFourDigits: saveResult.lastFourDigits,
      amount: params.amount,
      currency: 'ILS',
      vendorId: params.vendorId
    };

    // If instant charge, charge now
    if (params.instantCharge) {
      const chargeResult = await this.chargeSavedCard(
        saveResult.customerId,
        params.amount,
        `Booking: ${params.itemName}`,
        credentials
      );

      if (chargeResult.success) {
        return {
          paymentStatus: 'charged',
          paymentDetails: {
            ...paymentDetails,
            sumitPaymentId: chargeResult.paymentId,
            chargedAt: new Date()
          }
        };
      } else {
        return {
          paymentStatus: 'failed',
          paymentDetails: {
            ...paymentDetails,
            failureReason: chargeResult.error
          }
        };
      }
    }

    // Card saved, waiting for approval
    return {
      paymentStatus: 'card_saved',
      paymentDetails
    };
  },

  /**
   * Charge a reservation that has a saved card
   * Used when vendor approves a pending reservation
   * 
   * @returns Updated payment fields, or throws error if payment fails
   */
  async chargeReservation(reservation: {
    _id: any;
    totalPrice?: number;
    itemId: any;
    paymentDetails?: {
      sumitCustomerId?: string;
      amount?: number;
      vendorId?: string;
    };
  }): Promise<{
    paymentStatus: 'charged' | 'failed';
    sumitPaymentId?: string;
    chargedAt?: Date;
    failureReason?: string;
  }> {
    const { paymentDetails } = reservation;
    
    if (!paymentDetails?.sumitCustomerId || !paymentDetails?.vendorId) {
      throw new Error('Missing payment details for charging');
    }

    // Get vendor credentials
    const credentials = await this.getVendorCredentials(paymentDetails.vendorId);
    
    if (!credentials) {
      throw new Error('Vendor missing payment credentials');
    }

    // Get item name for description
    const item = await ItemModel.findById(reservation.itemId);
    const itemName = item?.name?.en || 'Reservation';
    const amount = paymentDetails.amount || reservation.totalPrice || 0;

    const chargeResult = await this.chargeSavedCard(
      paymentDetails.sumitCustomerId,
      amount,
      `Booking: ${itemName}`,
      credentials
    );

    if (chargeResult.success) {
      return {
        paymentStatus: 'charged',
        sumitPaymentId: chargeResult.paymentId,
        chargedAt: new Date()
      };
    } else {
      return {
        paymentStatus: 'failed',
        failureReason: chargeResult.error
      };
    }
  },

  /**
   * Refund a charged payment
   * Used when cancelling a reservation that was already charged
   */
  async refundPayment(
    sumitPaymentId: string,
    amount: number,
    credentials: VendorCredentials
  ): Promise<RefundResult> {
    try {
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/refund/`,
        {
          PaymentID: sumitPaymentId,
          Amount: amount,
          Credentials: {
            CompanyID: credentials.companyId,
            APIKey: credentials.apiKey
          }
        }
      );

      // Sumit refund API returns success if refund was processed
      if (response.data?.Data?.Refund?.ID || response.data?.Status === 0) {
        return {
          success: true,
          refundId: response.data?.Data?.Refund?.ID || response.data?.Data?.ID
        };
      }

      return {
        success: false,
        error: response.data?.UserErrorMessage || response.data?.Data?.StatusDescription || 'Refund failed'
      };
    } catch (error: any) {
      console.error('Refund error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Refund failed'
      };
    }
  },

  /**
   * Refund a reservation that was charged
   * Used when cancelling a confirmed reservation with payment
   * 
   * @returns Updated payment fields
   */
  async refundReservation(reservation: {
    _id: any;
    paymentDetails?: {
      sumitPaymentId?: string;
      amount?: number;
      vendorId?: string;
    };
  }): Promise<{
    success: boolean;
    paymentStatus?: 'refunded';
    refundId?: string;
    error?: string;
  }> {
    const { paymentDetails } = reservation;
    
    if (!paymentDetails?.sumitPaymentId || !paymentDetails?.vendorId || !paymentDetails?.amount) {
      return {
        success: false,
        error: 'Missing payment details for refund'
      };
    }

    // Get vendor credentials
    const credentials = await this.getVendorCredentials(paymentDetails.vendorId);
    
    if (!credentials) {
      return {
        success: false,
        error: 'Vendor missing payment credentials'
      };
    }

    const refundResult = await this.refundPayment(
      paymentDetails.sumitPaymentId,
      paymentDetails.amount,
      credentials
    );

    if (refundResult.success) {
      return {
        success: true,
        paymentStatus: 'refunded',
        refundId: refundResult.refundId
      };
    } else {
      return {
        success: false,
        error: refundResult.error
      };
    }
  },

  /**
   * Detect card brand from last 4 digits or BIN
   * This is a simple heuristic - in production you'd get this from Sumit
   */
  detectCardBrand(lastFourDigits?: string): string {
    // Default to visa if we can't detect
    return 'visa';
  },

  /**
   * Get user's saved card info
   * First checks local database, then optionally verifies with Sumit
   * Returns null if user has no saved card
   */
  async getUserSavedCard(userId: string, verifyWithSumit: boolean = false): Promise<{
    id: string;
    last4: string;
    brand: string;
    sumitCustomerId: string;
    expirationMonth?: number;
    expirationYear?: number;
  } | null> {
    const user = await UserModel.findById(userId);
    
    if (!user?.sumitCustomerId) {
      return null;
    }

    // If we have local data and don't need to verify, return cached data
    if (!verifyWithSumit && user.savedCardLastFour) {
      return {
        id: user.sumitCustomerId,
        last4: user.savedCardLastFour,
        brand: user.savedCardBrand || 'visa',
        sumitCustomerId: user.sumitCustomerId
      };
    }

    // Fetch fresh data from Sumit
    const sumitResult = await this.getSavedPaymentMethods(user.sumitCustomerId);
    
    if (!sumitResult.success || !sumitResult.paymentMethod) {
      // Card might have been removed from Sumit - clear local data
      if (user.savedCardLastFour) {
        await UserModel.findByIdAndUpdate(userId, {
          $unset: { savedCardLastFour: 1, savedCardBrand: 1 }
        });
      }
      return null;
    }

    const pm = sumitResult.paymentMethod;
    
    // Update local cache with fresh data
    const brand = this.detectCardBrand(pm.lastFourDigits);
    await UserModel.findByIdAndUpdate(userId, {
      savedCardLastFour: pm.lastFourDigits,
      savedCardBrand: brand
    });

    return {
      id: user.sumitCustomerId,
      last4: pm.lastFourDigits,
      brand: brand,
      sumitCustomerId: user.sumitCustomerId,
      expirationMonth: pm.expirationMonth,
      expirationYear: pm.expirationYear
    };
  },

  /**
   * Charge using a user's saved card (by Sumit customer ID)
   * Used when user selects a previously saved card
   */
  async chargeWithSavedCard(params: {
    userId: string;
    vendorId: string;
    amount: number;
    description: string;
  }): Promise<{
    success: boolean;
    paymentId?: string;
    error?: string;
  }> {
    // Get user's saved card
    const user = await UserModel.findById(params.userId);
    if (!user?.sumitCustomerId) {
      return { success: false, error: 'User has no saved card' };
    }

    // Get vendor credentials
    const credentials = await this.getVendorCredentials(params.vendorId);
    if (!credentials) {
      return { success: false, error: 'Vendor not set up for payments' };
    }

    // Charge the saved card
    return this.chargeSavedCard(
      user.sumitCustomerId,
      params.amount,
      params.description,
      credentials
    );
  },

  /**
   * Remove user's saved card
   */
  async removeUserSavedCard(userId: string): Promise<boolean> {
    try {
      await UserModel.findByIdAndUpdate(userId, {
        $unset: {
          sumitCustomerId: 1,
          savedCardLastFour: 1,
          savedCardBrand: 1
        }
      });
      return true;
    } catch (error) {
      console.error('Failed to remove saved card:', error);
      return false;
    }
  }
};
