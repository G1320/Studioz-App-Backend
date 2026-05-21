import axios from 'axios';
import { UserModel } from '../models/userModel.js';
import { ItemModel } from '../models/itemModel.js';
import { PaymentMethodModel, type PaymentMethodDoc } from '../models/paymentMethodModel.js';
import { saveSumitInvoice } from '../utils/sumitUtils.js';
import { usageService } from './usageService.js';
import { platformFeeService } from './platformFeeService.js';

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
    credentials: VendorCredentials,
    customerInfo?: { email?: string; name?: string; phone?: string }
  ): Promise<ChargeResult> {
    try {
      console.log('[Payment Debug] Charging saved card via multivendorcharge:', {
        customerId: sumitCustomerId,
        amount,
        vendorCompanyId: credentials.companyId,
        hasEmail: !!customerInfo?.email,
        hasPhone: !!customerInfo?.phone
      });

      // Fetch saved card details so we can pass them explicitly —
      // multivendorcharge needs the token + expiration in PaymentMethod.
      let paymentMethod: Record<string, any> | undefined;
      try {
        const saved = await this.getSavedPaymentMethods(sumitCustomerId);
        if (saved.success && saved.paymentMethod) {
          paymentMethod = {
            CreditCard_Token: saved.paymentMethod.token,
            CreditCard_ExpirationMonth: saved.paymentMethod.expirationMonth,
            CreditCard_ExpirationYear: saved.paymentMethod.expirationYear,
            Type: 1
          };
        }
      } catch (err) {
        console.warn('[Payment Debug] Could not fetch payment method details:', err);
      }

      // SearchMode 0 (Automatic) finds customers by email, phone, or name.
      // SearchMode 1 (by ID) returns "Invalid Customer ID" in multivendorcharge,
      // so we always use SearchMode 0 with whatever identifier is available.
      const hasIdentifier = customerInfo?.email || customerInfo?.phone || customerInfo?.name;
      const customer = hasIdentifier
        ? {
            ...(customerInfo?.name && { Name: customerInfo.name }),
            ...(customerInfo?.email && { EmailAddress: customerInfo.email }),
            ...(customerInfo?.phone && { Phone: customerInfo.phone }),
            SearchMode: 0
          }
        : { ID: parseInt(sumitCustomerId), SearchMode: 1 };

      const response = await axios.post(
        `${SUMIT_API_URL}/billing/payments/multivendorcharge/`,
        {
          Customer: customer,
          ...(paymentMethod && { PaymentMethod: paymentMethod }),
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

      // Multivendorcharge response: Data.Vendors[].Payment (NOT .Items.Payment)
      const vendors = response.data?.Data?.Vendors;
      const vendorData = vendors?.[0];
      const payment = vendorData?.Payment;

      console.log('[Payment Debug] Charge response:', {
        validPayment: payment?.ValidPayment,
        paymentId: payment?.ID,
        vendorCount: vendors?.length,
        status: response.data?.Status
      });

      if (payment?.ValidPayment) {
        saveSumitInvoice({
          Payment: payment,
          DocumentID: vendorData?.DocumentID,
          DocumentNumber: vendorData?.DocumentNumber,
          DocumentDownloadURL: vendorData?.DocumentDownloadURL,
          CustomerID: vendorData?.CustomerID
        }, {
          description: description
        });

        return {
          success: true,
          paymentId: payment.ID
        };
      }

      return {
        success: false,
        error: payment?.StatusDescription || response.data?.UserErrorMessage || 'Payment failed'
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
    userId?: string;
    amount: number;
    itemName: string;
    instantCharge: boolean;
    reservationId?: string;
    studioId?: string;
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
    // Get vendor credentials (only needed for instant charging, not for saving cards)
    const credentials = await this.getVendorCredentials(params.vendorId);
    
    console.log('[Payment Debug] handleReservationPayment called:', {
      vendorId: params.vendorId,
      userId: params.userId,
      hasVendorCredentials: !!credentials,
      instantCharge: params.instantCharge
    });

    // Save the card using PLATFORM credentials (works regardless of vendor setup)
    // The credentials param is ignored by saveCardForLaterCharge - it uses platform credentials
    const saveResult = await this.saveCardForLaterCharge(
      params.singleUseToken,
      params.customerInfo,
      credentials || { companyId: '', apiKey: '', vendorId: params.vendorId } // Placeholder - not used
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

    // Store as a PaymentMethod document (multi-card support)
    if (params.userId && saveResult.customerId) {
      try {
        await this.addPaymentMethod(
          params.userId,
          saveResult.customerId,
          saveResult.creditCardToken || '',
          saveResult.lastFourDigits || ''
        );
      } catch (error) {
        console.error('Failed to save card info:', error);
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

    // If instant charge AND vendor has credentials, charge now
    if (params.instantCharge && credentials) {
      const chargeResult = await this.chargeSavedCard(
        saveResult.customerId,
        params.amount,
        `Booking: ${params.itemName}`,
        credentials,
        { email: params.customerInfo.email, name: params.customerInfo.name, phone: params.customerInfo.phone }
      );

      if (chargeResult.success) {
        // Track payment for subscription limits
        try {
          await usageService.incrementPaymentCount(params.vendorId, params.amount);
        } catch (trackingError) {
          console.error('Failed to track payment usage:', trackingError);
        }

        // Record platform fee
        platformFeeService.recordFee({
          vendorId: params.vendorId,
          transactionAmount: params.amount,
          transactionType: 'reservation',
          reservationId: params.reservationId,
          studioId: params.studioId,
          sumitPaymentId: chargeResult.paymentId
        });
        
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
    } else if (params.instantCharge && !credentials) {
      // Vendor doesn't have credentials - card is saved but can't charge
      console.log('[Payment Debug] Instant charge requested but vendor has no credentials. Card saved only.');
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
    itemId?: any;
    studioId?: any;
    userId?: any;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
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

    // Collect customer identifiers for SearchMode 0 (Automatic).
    // Reservation has customerEmail/customerPhone/customerName directly.
    // Non-logged-in guests may only have a phone — that's fine for SearchMode 0.
    let customerEmail = reservation.customerEmail;
    let customerName = reservation.customerName;
    let customerPhone = reservation.customerPhone;

    if (!customerEmail && !customerPhone && reservation.userId) {
      const user = await UserModel.findById(reservation.userId);
      customerEmail = user?.email;
      customerName = customerName || user?.name;
      customerPhone = customerPhone || (user as any)?.phone;
    }

    const chargeResult = await this.chargeSavedCard(
      paymentDetails.sumitCustomerId,
      amount,
      `Booking: ${itemName}`,
      credentials,
      { email: customerEmail, name: customerName, phone: customerPhone }
    );

    if (chargeResult.success) {
      // Track payment for subscription limits
      try {
        await usageService.incrementPaymentCount(paymentDetails.vendorId, amount);
      } catch (trackingError) {
        console.error('Failed to track payment usage:', trackingError);
      }

      // Record platform fee
      platformFeeService.recordFee({
        vendorId: paymentDetails.vendorId,
        transactionAmount: amount,
        transactionType: 'reservation',
        reservationId: reservation._id?.toString(),
        studioId: reservation.studioId?.toString(),
        sumitPaymentId: chargeResult.paymentId
      });
      
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
      // Credit the platform fee for this reservation
      if (reservation._id) {
        platformFeeService.creditFee(reservation._id.toString(), 'Reservation refunded');
      }

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

  detectCardBrand(_lastFourDigits?: string): string {
    return 'visa';
  },

  // ================================================================
  // Multi-card payment method management
  // ================================================================

  /**
   * Add a new payment method for a user.
   * If the user has no existing cards, this becomes the default.
   * Also backfills the legacy User fields for backward compatibility.
   */
  async addPaymentMethod(
    userId: string,
    sumitCustomerId: string,
    cardToken: string,
    lastFour: string,
    extra?: { expirationMonth?: number; expirationYear?: number; cardMask?: string; brand?: string }
  ): Promise<PaymentMethodDoc> {
    const existingCount = await PaymentMethodModel.countDocuments({ userId });
    const isDefault = existingCount === 0;

    // Try to fetch full details from Sumit if we don't have them
    let expirationMonth = extra?.expirationMonth;
    let expirationYear = extra?.expirationYear;
    let cardMask = extra?.cardMask;
    let resolvedToken = cardToken;

    if ((!expirationMonth || !resolvedToken) && sumitCustomerId) {
      try {
        const sumitResult = await this.getSavedPaymentMethods(sumitCustomerId);
        if (sumitResult.success && sumitResult.paymentMethod) {
          expirationMonth = expirationMonth || sumitResult.paymentMethod.expirationMonth;
          expirationYear = expirationYear || sumitResult.paymentMethod.expirationYear;
          cardMask = cardMask || sumitResult.paymentMethod.cardMask;
          resolvedToken = resolvedToken || sumitResult.paymentMethod.token;
        }
      } catch (err) {
        console.warn('[PaymentMethod] Could not fetch details from Sumit:', err);
      }
    }

    const pm = await PaymentMethodModel.create({
      userId,
      sumitCustomerId,
      cardToken: resolvedToken,
      lastFour,
      brand: extra?.brand || this.detectCardBrand(lastFour),
      expirationMonth,
      expirationYear,
      cardMask,
      isDefault,
    });

    // Keep legacy User fields in sync with the latest card
    try {
      await UserModel.findByIdAndUpdate(userId, {
        sumitCustomerId,
        savedCardLastFour: lastFour,
        savedCardBrand: pm.brand,
      });
    } catch (err) {
      console.warn('[PaymentMethod] Failed to sync legacy User fields:', err);
    }

    return pm;
  },

  /**
   * Get all payment methods for a user.
   * Performs lazy migration: if user has legacy fields but no PaymentMethod docs,
   * creates one from the legacy data.
   */
  async getUserPaymentMethods(userId: string): Promise<PaymentMethodDoc[]> {
    let methods = await PaymentMethodModel.find({ userId }).sort({ isDefault: -1, createdAt: -1 });

    if (methods.length === 0) {
      // Lazy migration from legacy single-card fields
      const user = await UserModel.findById(userId);
      if (user?.sumitCustomerId && user.savedCardLastFour) {
        try {
          const migrated = await this.addPaymentMethod(
            userId,
            user.sumitCustomerId,
            '', // token will be fetched from Sumit inside addPaymentMethod
            user.savedCardLastFour,
            { brand: user.savedCardBrand || 'visa' }
          );
          methods = [migrated] as typeof methods;
        } catch (err) {
          console.error('[PaymentMethod] Lazy migration failed:', err);
        }
      }
    }

    return methods;
  },

  /**
   * Get a single payment method by its _id (our DB id, not Sumit's).
   */
  async getPaymentMethodById(paymentMethodId: string): Promise<PaymentMethodDoc | null> {
    return PaymentMethodModel.findById(paymentMethodId);
  },

  /**
   * Get the user's default payment method, or the most recent one.
   */
  async getDefaultPaymentMethod(userId: string): Promise<PaymentMethodDoc | null> {
    const defaultCard = await PaymentMethodModel.findOne({ userId, isDefault: true });
    if (defaultCard) return defaultCard;
    return PaymentMethodModel.findOne({ userId }).sort({ createdAt: -1 });
  },

  /**
   * Set a specific card as the user's default.
   */
  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<boolean> {
    const card = await PaymentMethodModel.findOne({ _id: paymentMethodId, userId });
    if (!card) return false;

    await PaymentMethodModel.updateMany({ userId }, { isDefault: false });
    card.isDefault = true;
    await card.save();

    // Sync legacy fields
    try {
      await UserModel.findByIdAndUpdate(userId, {
        sumitCustomerId: card.sumitCustomerId,
        savedCardLastFour: card.lastFour,
        savedCardBrand: card.brand,
      });
    } catch (err) {
      console.warn('[PaymentMethod] Failed to sync legacy fields on default change:', err);
    }

    return true;
  },

  /**
   * Remove a specific payment method by _id.
   */
  async removePaymentMethod(userId: string, paymentMethodId: string): Promise<boolean> {
    const card = await PaymentMethodModel.findOne({ _id: paymentMethodId, userId });
    if (!card) return false;

    // Try to remove from Sumit
    if (card.sumitCustomerId) {
      const sumitResult = await this.removeSavedPaymentMethodFromSumit(card.sumitCustomerId);
      if (!sumitResult.success) {
        console.warn('[PaymentMethod] Failed to remove from Sumit:', sumitResult.error);
      }
    }

    const wasDefault = card.isDefault;
    await PaymentMethodModel.deleteOne({ _id: paymentMethodId });

    // If we removed the default, promote the next card
    if (wasDefault) {
      const next = await PaymentMethodModel.findOne({ userId }).sort({ createdAt: -1 });
      if (next) {
        next.isDefault = true;
        await next.save();
        await UserModel.findByIdAndUpdate(userId, {
          sumitCustomerId: next.sumitCustomerId,
          savedCardLastFour: next.lastFour,
          savedCardBrand: next.brand,
        });
      } else {
        // No cards left — clear legacy fields
        await UserModel.findByIdAndUpdate(userId, {
          $unset: { sumitCustomerId: 1, savedCardLastFour: 1, savedCardBrand: 1 },
        });
      }
    }

    return true;
  },

  /**
   * Charge using a stored PaymentMethod document.
   * Passes the stored token directly to multivendorcharge.
   */
  async chargeWithPaymentMethod(
    paymentMethodId: string,
    amount: number,
    description: string,
    credentials: VendorCredentials,
    customerInfo?: { email?: string; name?: string; phone?: string }
  ): Promise<ChargeResult> {
    const pm = await PaymentMethodModel.findById(paymentMethodId);
    if (!pm) {
      return { success: false, error: 'Payment method not found' };
    }

    return this.chargeSavedCard(
      pm.sumitCustomerId,
      amount,
      description,
      credentials,
      customerInfo
    );
  },

  /**
   * Legacy helper — kept for backward compat.
   * Prefers PaymentMethod collection, falls back to User fields.
   */
  async getUserSavedCard(userId: string, _verifyWithSumit: boolean = false): Promise<{
    id: string;
    last4: string;
    brand: string;
    sumitCustomerId: string;
    expirationMonth?: number;
    expirationYear?: number;
  } | null> {
    const defaultPm = await this.getDefaultPaymentMethod(userId);
    if (defaultPm) {
      return {
        id: defaultPm._id.toString(),
        last4: defaultPm.lastFour,
        brand: defaultPm.brand,
        sumitCustomerId: defaultPm.sumitCustomerId,
        expirationMonth: defaultPm.expirationMonth,
        expirationYear: defaultPm.expirationYear,
      };
    }

    // Legacy fallback
    const user = await UserModel.findById(userId);
    if (!user?.sumitCustomerId) return null;

    return {
      id: user.sumitCustomerId,
      last4: user.savedCardLastFour || '****',
      brand: user.savedCardBrand || 'visa',
      sumitCustomerId: user.sumitCustomerId,
    };
  },

  /**
   * Charge using a user's saved card (by Sumit customer ID).
   * Prefers PaymentMethod collection for lookup.
   */
  async chargeWithSavedCard(params: {
    userId: string;
    vendorId: string;
    amount: number;
    description: string;
  }): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    const defaultPm = await this.getDefaultPaymentMethod(params.userId);
    const sumitCustomerId = defaultPm?.sumitCustomerId
      || (await UserModel.findById(params.userId))?.sumitCustomerId;

    if (!sumitCustomerId) {
      return { success: false, error: 'User has no saved card' };
    }

    const credentials = await this.getVendorCredentials(params.vendorId);
    if (!credentials) {
      return { success: false, error: 'Vendor not set up for payments' };
    }

    const user = await UserModel.findById(params.userId);
    return this.chargeSavedCard(
      sumitCustomerId,
      params.amount,
      params.description,
      credentials,
      { email: user?.email, name: user?.name, phone: user?.phone }
    );
  },

  /**
   * Remove saved payment method from Sumit.
   */
  async removeSavedPaymentMethodFromSumit(sumitCustomerId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await axios.post(
        `${SUMIT_API_URL}/billing/paymentmethods/remove/`,
        {
          Credentials: {
            CompanyID: PLATFORM_COMPANY_ID,
            APIKey: PLATFORM_API_KEY,
          },
          Customer: {
            ID: parseInt(sumitCustomerId),
            SearchMode: 1,
          },
        }
      );

      const isSuccess = response.data?.Status === 0 || response.data?.Data?.Status === 0;
      if (isSuccess) return { success: true };

      return {
        success: false,
        error: response.data?.UserErrorMessage || response.data?.Data?.UserErrorMessage || 'Failed to remove payment method from Sumit',
      };
    } catch (error: any) {
      console.error('Remove payment method from Sumit error:', error.response?.data || error);
      return {
        success: false,
        error: error.response?.data?.UserErrorMessage || 'Failed to remove payment method from Sumit',
      };
    }
  },

  /**
   * Remove all saved cards for a user (legacy method kept for backward compat).
   */
  async removeUserSavedCard(userId: string): Promise<boolean> {
    try {
      const methods = await PaymentMethodModel.find({ userId });
      for (const pm of methods) {
        if (pm.sumitCustomerId) {
          await this.removeSavedPaymentMethodFromSumit(pm.sumitCustomerId).catch(() => {});
        }
      }
      await PaymentMethodModel.deleteMany({ userId });
      await UserModel.findByIdAndUpdate(userId, {
        $unset: { sumitCustomerId: 1, savedCardLastFour: 1, savedCardBrand: 1 },
      });
      return true;
    } catch (error) {
      console.error('Failed to remove saved cards:', error);
      return false;
    }
  }
};
