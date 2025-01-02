import { UserModel } from "../models/userModel.js";
interface SellerDetails {
    email: string;
    name?: string;
  }
  
  export const getSellerDetails = async (sellerId: string): Promise<SellerDetails> => {
    const seller = await UserModel.findOne({ paypalMerchantId: sellerId });
    
    if (!seller) {
      throw new Error(`Seller not found with paypalMerchantId: ${sellerId}`);
    }
  
    return {
      email: seller.email || '',
      name: seller.name
    };
  };