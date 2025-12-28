import mongoose from 'mongoose';
import { CouponModel } from '../models/couponModel.js';
import { DB_URL } from '../config/index.js';

const seedCoupon = async () => {
  try {
    // Connect to database
    await mongoose.connect(DB_URL as string);
    console.log('Connected to database');

    // Check if coupon already exists
    const existingCoupon = await CouponModel.findOne({ code: 'WELCOME20' });
    if (existingCoupon) {
      console.log('Coupon WELCOME20 already exists:', existingCoupon);
      await mongoose.disconnect();
      return;
    }

    // Create the coupon
    const coupon = await CouponModel.create({
      code: 'WELCOME20',
      discountType: 'percentage',
      discountValue: 20,
      maxUses: 20,
      usedCount: 0,
      validFrom: new Date(),
      validUntil: new Date('2026-03-22'),
      isActive: true,
      applicablePlans: ['all'],
      minPurchaseAmount: 0
    });

    console.log('Coupon created successfully:', coupon);

    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error seeding coupon:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedCoupon();
