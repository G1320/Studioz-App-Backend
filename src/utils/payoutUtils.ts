import { StudioModel } from "../models/studioModel.js";
import { UserModel } from "../models/userModel.js";
interface SellerDetails {
    email: string;
    name?: string;
    address?: string;
  }
  
  export const getSellerDetails = async (sellerId: string): Promise<SellerDetails> => {
    const seller = await UserModel.findOne({ paypalMerchantId: sellerId });
    const studio = await StudioModel.findOne({ paypalMerchantId: sellerId });
    
    if (!seller) {
      throw new Error(`Seller not found with paypalMerchantId: ${sellerId}`);
    }
  
    return {
      email: seller.email || '',
      name: seller.name,
      address: studio?.address
    };
  };