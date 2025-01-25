import { Request } from 'express';
import axios from 'axios';
import ExpressError from '../../../utils/expressError.js';
import handleRequest from '../../../utils/requestHandler.js';
import { UserModel } from '../../../models/userModel.js';

const SUMIT_API_URL = 'https://api.sumit.co.il';
const COMPANY_ID = process.env.SUMIT_COMPANY_ID;
const API_KEY = process.env.SUMIT_API_KEY;

const createVendor = handleRequest(async (req: Request) => {
  const { companyDetails, userId } = req.body;

  if (!companyDetails) {
    throw new ExpressError('Company details are required', 400);
  }

  const createResponse = await axios.post(
    `${SUMIT_API_URL}/website/companies/create/`,
    {
      Company: {
        ...companyDetails,
        CompanyType: 0
      },
      Credentials: {
        CompanyID: COMPANY_ID,
        APIKey: API_KEY
      }
    }
    );
    if (!createResponse.data?.Data) {
      throw new ExpressError('Failed to create vendor', 400);
    }
    const paymentResponse = await axios.post(
      `${SUMIT_API_URL}/billing/generalbilling/openupayterminal/`,
      {
        Credentials: {
          CompanyID: createResponse.data.Data.CompanyID,
          APIKey: createResponse.data.Data.APIKey
        },
        BankCode: companyDetails.bankCode,
        BranchCode: companyDetails.branchCode,
        AccountNumber: companyDetails.accountNumber,
        Program: "OFFICEGUYNEW10"
      }
      );
      console.log('paymentResponse: ', paymentResponse);
      
  
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        sumitCompanyId: createResponse.data.Data.CompanyID,
        sumitApiKey: createResponse.data.Data.APIKey,
        sumitApiPublicKey: createResponse.data.Data.APIPublicKey,
        role: 'vendor'
      },
      { new: true }
      );
  
    if (!updatedUser) {
      throw new ExpressError('Failed to update user with vendor details', 400);
    }

  return {createResponse, paymentResponse, updatedUser};
});

export default {
  createVendor
};