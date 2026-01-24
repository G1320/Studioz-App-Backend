import { faker } from '@faker-js/faker';
import { Types } from 'mongoose';
import { UserModel } from '../../models/userModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { ItemModel } from '../../models/itemModel.js';
import { SubscriptionModel } from '../../models/sumitModels/subscriptionModel.js';
import { SubscriptionTier } from '../../config/subscriptionTiers.js';

/**
 * Create a test user in the database
 */
export async function createTestUser(overrides: Partial<any> = {}) {
  const defaultUser = {
    username: faker.internet.username(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    sub: `auth0|${faker.string.alphanumeric(24)}`,
    phone: faker.phone.number(),
    role: 'vendor',
    subscriptionStatus: 'ACTIVE',
    ...overrides,
  };

  const user = await UserModel.create(defaultUser);
  return user;
}

/**
 * Create a test studio in the database
 */
export async function createTestStudio(overrides: Partial<any> = {}) {
  const defaultStudio = {
    name: {
      en: faker.company.name(),
      he: faker.company.name(),
    },
    description: {
      en: faker.lorem.paragraph(),
      he: faker.lorem.paragraph(),
    },
    city: faker.location.city(),
    address: faker.location.streetAddress(),
    lat: faker.location.latitude(),
    lng: faker.location.longitude(),
    categories: ['Recording Studio'],
    active: true,
    paymentEnabled: true,
    ...overrides,
  };

  const studio = await StudioModel.create(defaultStudio);
  return studio;
}

/**
 * Create a test item in the database
 */
export async function createTestItem(overrides: Partial<any> = {}) {
  // Generate availability for the next 7 days
  const availability = generateAvailability(7);

  const defaultItem = {
    name: {
      en: faker.commerce.productName(),
      he: faker.commerce.productName(),
    },
    description: {
      en: faker.lorem.paragraph(),
      he: faker.lorem.paragraph(),
    },
    price: faker.number.int({ min: 50, max: 500 }),
    pricePer: 'hour',
    availability,
    instantBook: true,
    inStock: true,
    ...overrides,
  };

  const item = await ItemModel.create(defaultItem);
  return item;
}

/**
 * Generate availability for N days from today
 */
export function generateAvailability(days: number) {
  const availability = [];
  const times = generateTimeSlots();

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const dateStr = formatDate(date);
    availability.push({ date: dateStr, times: [...times] });
  }

  return availability;
}

/**
 * Generate time slots from 08:00 to 22:00
 */
export function generateTimeSlots(start = 8, end = 22) {
  const slots = [];
  for (let hour = start; hour < end; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return slots;
}

/**
 * Format date as DD/MM/YYYY (app format)
 */
export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Get tomorrow's date formatted
 */
export function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDate(tomorrow);
}

/**
 * Create a test subscription for a user
 */
export async function createTestSubscription(
  userId: Types.ObjectId | string,
  tier: SubscriptionTier = 'starter',
  overrides: Partial<any> = {}
) {
  const defaultSubscription = {
    userId,
    planId: tier,
    planName: tier.charAt(0).toUpperCase() + tier.slice(1),
    status: 'ACTIVE',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    isTrial: false,
    ...overrides,
  };

  const subscription = await SubscriptionModel.create(defaultSubscription);
  return subscription;
}

/**
 * Create a test user with an active subscription
 */
export async function createTestUserWithSubscription(
  tier: SubscriptionTier = 'starter',
  userOverrides: Partial<any> = {}
) {
  // First create the user without subscription
  const user = await createTestUser({
    ...userOverrides,
    subscriptionStatus: 'ACTIVE',
  });

  // Create the subscription
  const subscription = await createTestSubscription(user._id, tier);

  // Update user with subscription reference
  await UserModel.findByIdAndUpdate(user._id, {
    subscriptionId: subscription._id,
    subscriptionStatus: 'ACTIVE',
  });

  // Return updated user
  const updatedUser = await UserModel.findById(user._id);
  return { user: updatedUser!, subscription };
}

/**
 * Create a complete test setup with user, studio, and item
 */
export async function createTestSetup() {
  const user = await createTestUser();
  const studio = await createTestStudio({ createdBy: user._id });
  const item = await createTestItem({
    studioId: studio._id,
    sellerId: user._id,
    studioName: studio.name,
  });

  // Add item reference to studio
  await StudioModel.findByIdAndUpdate(studio._id, {
    $push: {
      items: {
        idx: 0,
        name: item.name,
        itemId: item._id,
        studioId: studio._id,
        sellerId: user._id,
        active: true,
      },
    },
  });

  return { user, studio, item };
}
