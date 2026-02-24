/**
 * Seed highly realistic demo data for the merchant stats / analytics dashboard.
 * Creates one demo vendor, 3 studios, 6 items, 15 customers, and 200+ reservations
 * spread over 14 months so Overview, Studios, Customers, Projections, and Insights
 * all show convincing numbers and charts for demo videos.
 *
 * Run: npx ts-node src/scripts/seedStatsDemo.ts
 * Or:  npm run seed:stats-demo
 *
 * After running, use the printed DEMO_VENDOR_USER_ID when opening the stats page
 * (e.g. set in .env as DEMO_STATS_USER_ID or log in as that user if configured in Auth0).
 */

import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { DB_URL } from '../config/index.js';
import { UserModel } from '../models/userModel.js';
import { StudioModel } from '../models/studioModel.js';
import { ItemModel } from '../models/itemModel.js';
import { ReservationModel } from '../models/reservationModel.js';

const DEMO_VENDOR_SUB = 'auth0|demo-stats-vendor-001';
const DEMO_VENDOR_EMAIL = 'demo-stats@studios-app.example.com';

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function timeSlots(hours: number, startHour: number = 9): string[] {
  const slots: string[] = [];
  for (let i = 0; i < hours; i++) {
    slots.push(`${String(startHour + i).padStart(2, '0')}:00`);
  }
  return slots;
}

const STUDIO_NAMES = [
  { en: 'North Tel Aviv Studio', he: 'סטודיו צפון תל אביב' },
  { en: 'South Recording Hub', he: 'מרכז ההקלטות דרום' },
  { en: 'Central Mix Room', he: 'חדר המיקס המרכזי' }
];

const ITEM_NAMES_PER_STUDIO = [
  [{ en: 'Main Live Room', he: 'אולם לייב ראשי' }, { en: 'Vocal Booth', he: 'תא קולי' }],
  [{ en: 'Full Band Room', he: 'חדר להקת מלאה' }, { en: 'Podcast Booth', he: 'תא פודקאסט' }],
  [{ en: 'Mixing Suite', he: 'סוויטת מיקס' }, { en: 'Mastering Room', he: 'חדר מאסטרינג' }]
];

const CUSTOMER_NAMES = [
  'Yael Cohen', 'David Levi', 'Noa Shapira', 'Eitan Mizrahi', 'Shira Ben-David',
  'Omer Goldman', 'Tamar Rosen', 'Ido Katz', 'Roni Avraham', 'Lior Friedman',
  'Maya Dahan', 'Niv Barak', 'Hila Golan', 'Yuval Peretz', 'Keren Weiss'
];

async function seedStatsDemo() {
  try {
    await mongoose.connect(DB_URL as string);
    console.log('Connected to database');

    let vendor = await UserModel.findOne({ sub: DEMO_VENDOR_SUB });
    if (!vendor) {
      vendor = await UserModel.create({
        username: 'demo-stats-vendor',
        name: 'Demo Stats Vendor',
        email: DEMO_VENDOR_EMAIL,
        sub: DEMO_VENDOR_SUB,
        role: 'vendor',
        subscriptionStatus: 'ACTIVE'
      });
      console.log('Created demo vendor:', vendor._id);
    } else {
      console.log('Using existing demo vendor:', vendor._id);
    }

    const vendorId = vendor._id;

    // Delete existing demo studios and their reservations/items
    const existingStudios = await StudioModel.find({ createdBy: vendorId });
    const existingStudioIds = existingStudios.map(s => s._id);
    const existingItemIds = existingStudios.flatMap(s => s.items?.map(i => i.itemId).filter(Boolean) || []);

    if (existingStudioIds.length > 0) {
      await ReservationModel.deleteMany({
        $or: [
          { studioId: { $in: existingStudioIds } },
          { itemId: { $in: existingItemIds } }
        ]
      });
      await ItemModel.deleteMany({ _id: { $in: existingItemIds } });
      await StudioModel.deleteMany({ _id: { $in: existingStudioIds } });
      console.log('Cleaned existing demo studios and reservations');
    }

    // Create or get customer users (so customerId and names match)
    const customerUsers: { _id: Types.ObjectId; name: string }[] = [];
    for (const name of CUSTOMER_NAMES) {
      const existing = await UserModel.findOne({
        email: name.toLowerCase().replace(/\s+/g, '.') + '@demo.studios-app.example.com'
      });
      if (existing) {
        customerUsers.push({ _id: existing._id as unknown as Types.ObjectId, name: existing.name });
      } else {
        const u = await UserModel.create({
          username: name.toLowerCase().replace(/\s+/g, '') + '_demo',
          name,
          email: name.toLowerCase().replace(/\s+/g, '.') + '@demo.studios-app.example.com',
          sub: 'auth0|demo-customer-' + name.toLowerCase().replace(/\s+/g, '') + '001',
          role: 'user'
        });
        customerUsers.push({ _id: u._id as unknown as Types.ObjectId, name: u.name });
      }
    }
    console.log('Customer users ready:', customerUsers.length);

    // Create 3 studios with 2 items each
    const studios: { _id: Types.ObjectId; name: { en: string; he: string }; itemIds: Types.ObjectId[] }[] = [];
    for (let s = 0; s < 3; s++) {
      const studio = await StudioModel.create({
        name: STUDIO_NAMES[s],
        city: 'Tel Aviv',
        address: `${100 + s * 10} Demo Street`,
        active: true,
        paymentEnabled: true,
        createdBy: vendorId
      });

      const itemIds: Types.ObjectId[] = [];
      for (let i = 0; i < 2; i++) {
        const item = await ItemModel.create({
          name: ITEM_NAMES_PER_STUDIO[s][i],
          studioId: studio._id,
          sellerId: vendorId,
          studioName: studio.name,
          price: 120 + s * 30 + i * 25,
          pricePer: 'hour',
          inStock: true,
          active: true,
          createdBy: vendorId
        });
        itemIds.push(item._id as unknown as Types.ObjectId);
      }

      await StudioModel.findByIdAndUpdate(studio._id, {
        $set: {
          items: itemIds.map((id, idx) => ({
            idx,
            itemId: id,
            studioId: studio._id,
            sellerId: vendorId,
            name: ITEM_NAMES_PER_STUDIO[s][idx],
            active: true
          }))
        }
      });

      studios.push({
        _id: studio._id as unknown as Types.ObjectId,
        name: studio.name as { en: string; he: string },
        itemIds
      });
    }
    console.log('Studios and items created:', studios.length);

    const now = new Date();
    const reservationsToCreate: any[] = [];
    const rng = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    // Reservations over the last 14 months + next month (for projections)
    for (let monthOffset = -14; monthOffset <= 1; monthOffset++) {
      const baseDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
      const count = monthOffset <= 0 ? rng(12, 28) : rng(3, 8);

      for (let n = 0; n < count; n++) {
        const day = rng(1, Math.min(28, daysInMonth));
        const bookDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), day);
        const studio = studios[rng(0, studios.length - 1)];
        const itemId = studio.itemIds[rng(0, studio.itemIds.length - 1)];
        const item = await ItemModel.findById(itemId);
        const itemPrice = item?.price ?? 150;
        const numSlots = rng(1, 4);
        const startH = rng(9, 18 - numSlots);
        const slots = timeSlots(numSlots, startH);
        const baseTotal = itemPrice * numSlots;

        const statusRand = Math.random();
        const status =
          statusRand < 0.78 ? 'confirmed'
            : statusRand < 0.92 ? 'cancelled'
              : statusRand < 0.97 ? 'pending' : 'expired';

        const customer = customerUsers[rng(0, customerUsers.length - 1)];
        const createdAt = new Date(bookDate);
        createdAt.setHours(rng(8, 20), rng(0, 59), 0, 0);

        reservationsToCreate.push({
          itemId,
          studioId: studio._id,
          userId: vendorId,
          customerId: customer._id,
          customerName: customer.name,
          bookingDate: formatDate(bookDate),
          timeSlots: slots,
          status,
          itemPrice,
          totalPrice: baseTotal,
          expiration: new Date(bookDate.getTime() + 7 * 24 * 60 * 60 * 1000),
          createdAt
        });
      }
    }

    const inserted = await ReservationModel.insertMany(reservationsToCreate);
    console.log('Reservations created:', inserted.length);

    // Apply coupon discount to ~20% of confirmed reservations
    const confirmedIds = inserted
      .filter(r => r.status === 'confirmed')
      .map(r => r._id);
    const toDiscount = Math.floor(confirmedIds.length * 0.22);
    const shuffle = [...confirmedIds].sort(() => Math.random() - 0.5);
    const idsToUpdate = shuffle.slice(0, toDiscount);

    for (const id of idsToUpdate) {
      const res = await ReservationModel.findById(id);
      if (!res || !res.totalPrice) continue;
          const priceBefore = res.totalPrice;
          const discountPercent = [10, 15, 20][rng(0, 2)];
          const couponDiscount = Math.round((priceBefore * discountPercent) / 100);
          await ReservationModel.updateOne(
            { _id: id },
            {
              $set: {
                couponCode: 'DEMO20',
                couponDiscount,
                priceBeforeDiscount: priceBefore,
                totalPrice: priceBefore - couponDiscount
              }
            }
          );
    }
    console.log('Applied coupon discounts to', idsToUpdate.length, 'reservations');

    console.log('\n--- Demo stats seed complete ---');
    console.log('DEMO_VENDOR_USER_ID=' + vendorId.toString());
    console.log('Use this userId when opening the merchant stats page (e.g. set in .env as DEMO_STATS_USER_ID or log in as this user).\n');

    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error seeding stats demo:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedStatsDemo();
