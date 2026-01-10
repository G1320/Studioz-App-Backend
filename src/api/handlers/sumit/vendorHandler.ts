import { Request } from 'express';
import axios from 'axios';
import ExpressError from '../../../utils/expressError.js';
import handleRequest from '../../../utils/requestHandler.js';
import { UserModel } from '../../../models/userModel.js';
import { StudioModel } from '../../../models/studioModel.js';

const SUMIT_API_URL = 'https://api.sumit.co.il';
const COMPANY_ID = process.env.SUMIT_COMPANY_ID;
const API_KEY = process.env.SUMIT_API_KEY;

const createVendor = handleRequest(async (req: Request) => {
  const { companyDetails, userId } = req.body;

  if (!companyDetails) {
    throw new ExpressError('Company details are required', 400);
  }

  if (!userId) {
    throw new ExpressError('User ID is required', 400);
  }

  // Validate required fields
  const requiredFields = ['Name', 'EmailAddress', 'Phone', 'CorporateNumber', 'bankCode', 'branchCode', 'accountNumber'];
  for (const field of requiredFields) {
    if (!companyDetails[field]) {
      throw new ExpressError(`${field} is required`, 400);
    }
  }

  // Step 1: Create the vendor company in Sumit
  const createResponse = await axios.post(
    `${SUMIT_API_URL}/website/companies/create/`,
    {
      Company: {
        ...companyDetails,
        CompanyType: 0
      },
      Applications: ['CreditCard'], // Enable credit card processing module
      Credentials: {
        CompanyID: COMPANY_ID,
        APIKey: API_KEY
      }
    }
  );

  if (!createResponse.data?.Data?.CompanyID) {
    const errorMsg = createResponse.data?.UserErrorMessage || 'Failed to create vendor in Sumit';
    throw new ExpressError(errorMsg, 400);
  }

  const vendorCredentials = {
    CompanyID: createResponse.data.Data.CompanyID,
    APIKey: createResponse.data.Data.APIKey,
    APIPublicKey: createResponse.data.Data.APIPublicKey
  };

  // Step 2: Open payment terminal for the vendor
  const paymentResponse = await axios.post(
    `${SUMIT_API_URL}/billing/generalbilling/openupayterminal/`,
    {
      Credentials: {
        CompanyID: vendorCredentials.CompanyID,
        APIKey: vendorCredentials.APIKey
      },
      BankCode: companyDetails.bankCode,
      BranchCode: companyDetails.branchCode,
      AccountNumber: companyDetails.accountNumber,
      Program: "OFFICEGUYNEW10"
    }
  );

  // Validate payment terminal was opened successfully
  if (paymentResponse.data?.Status !== 0 && !paymentResponse.data?.Data) {
    const errorMsg = paymentResponse.data?.UserErrorMessage || 'Failed to open payment terminal';
    console.error('Payment terminal error:', paymentResponse.data);
    throw new ExpressError(errorMsg, 400);
  }

  console.log('Payment terminal opened successfully:', paymentResponse.data);

  // Step 3: Update user with vendor credentials
  const updatedUser = await UserModel.findByIdAndUpdate(
    userId,
    {
      sumitCompanyId: vendorCredentials.CompanyID,
      sumitApiKey: vendorCredentials.APIKey,
      sumitApiPublicKey: vendorCredentials.APIPublicKey,
      role: 'vendor'
    },
    { new: true }
  );

  if (!updatedUser) {
    throw new ExpressError('Failed to update user with vendor details', 400);
  }

  // Step 4: Enable payments on all studios owned by this user
  const studioUpdateResult = await StudioModel.updateMany(
    { createdBy: userId },
    { paymentEnabled: true }
  );

  return {
    success: true,
    vendor: {
      companyId: vendorCredentials.CompanyID,
      hasPaymentTerminal: true
    },
    user: {
      _id: updatedUser._id,
      role: updatedUser.role
    },
    studiosUpdated: studioUpdateResult.modifiedCount
  };
});

export default {
  createVendor
};