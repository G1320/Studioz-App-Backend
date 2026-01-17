import { Request } from 'express';

import { UserModel } from '../../models/userModel.js';
import { StudioModel } from '../../models/studioModel.js';
import handleRequest from '../../utils/requestHandler.js';
import ExpressError from '../../utils/expressError.js';
import { paymentService } from '../../services/paymentService.js';
import emailPreferencesService from '../../services/emailPreferencesService.js';

const createUser = handleRequest(async (req: Request) => {
  const { username, name } = req.body;

  // Check if username or email already exist in the database
  const existingUser = await UserModel.findOne({ $or: [{ username }, { name }] });
  if (existingUser) throw new Error('Username or email already exists');

  const user = new UserModel(req.body);
  await user.save();
  return user;
});

const getUserBySub = handleRequest(async (req: Request) => {
  const user = await UserModel.findOne({ sub: req.params.sub });

  if (!user) return null;

  return user;
});
const getUserByMerchantId = handleRequest(async (req: Request) => {
  const user = await UserModel.findOne({ paypalMerchantId: req.params.merchantId });

  if (!user) return null;

  return user;
});

const getUserStudios = handleRequest(async (req: Request) => {
  const user = await UserModel.findById(req.params.id);
  if (!user) throw new ExpressError('User not found', 404);

  const studios = await StudioModel.find({ _id: { $in: user.studios } });
  if (!studios) throw new ExpressError('No studios found for this user', 404);

  return studios;
});

const addStudioToUser = handleRequest(async (req: Request) => {
  const userId = req.params.id;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const studioId = req.params.studioId;
  if (!studioId) throw new ExpressError('Studio ID not provided', 400);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  const studio = await StudioModel.findById(studioId);

  if (!studio) throw new ExpressError('Studio not found', 404);
  if (!studio.items) studio.items = [];
  if (user.studios?.includes(studio._id)) throw new ExpressError('Studio already added!', 400);
  // if (studio.items.length < 1) throw new ExpressError('Studio is empty, add some items first!', 400);

  user.studios?.push(studio._id);
  await user.save();

  return studio;
});

const removeStudioFromUser = handleRequest(async (req: Request) => {
  const userId = req.params.id;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const studioId = req.params.studioId;
  if (!studioId) throw new ExpressError('Studio ID not provided', 400);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('Studio not found', 404);

  await UserModel.findByIdAndUpdate(userId, { $pull: { studios: studio._id } });

  await user.save();

  return studio;
});

const getAllUsers = handleRequest(async (req: Request) => {
  // Pagination parameters with sensible defaults
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    UserModel.find({}).skip(skip).limit(limit).sort({ createdAt: -1 }),
    UserModel.countDocuments({})
  ]);

  if (!users || users.length === 0) throw new ExpressError('No users found', 404);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
});

const updateUser = handleRequest(async (req: Request) => {
  const user = await UserModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!user) throw new ExpressError('User not found', 404);

  return user;
});

const deleteUser = handleRequest(async (req: Request) => {
  const user = await UserModel.findByIdAndDelete(req.params.id);
  if (!user) throw new ExpressError('User not found', 404);

  // Using the "null" return to signal a 204 No Content response
  return null;
});

/**
 * Get user's saved cards
 * Returns an array with 0 or 1 cards (we only support one saved card per user currently)
 */
const getSavedCards = handleRequest(async (req: Request) => {
  const userId = req.params.id;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const savedCard = await paymentService.getUserSavedCard(userId);
  
  // Return as array for future multi-card support
  return savedCard ? [savedCard] : [];
});

/**
 * Remove user's saved card
 */
const removeSavedCard = handleRequest(async (req: Request) => {
  const userId = req.params.id;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const success = await paymentService.removeUserSavedCard(userId);

  if (!success) {
    throw new ExpressError('Failed to remove saved card', 500);
  }

  return { success: true };
});

/**
 * Get user's email preferences
 * GET /api/users/:id/email-preferences
 */
const getEmailPreferences = handleRequest(async (req: Request) => {
  const userId = req.params.id;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const preferences = await emailPreferencesService.getEmailPreferences(userId);
  return preferences;
});

/**
 * Update user's email preferences
 * PUT /api/users/:id/email-preferences
 */
const updateEmailPreferences = handleRequest(async (req: Request) => {
  const userId = req.params.id;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const { preferences } = req.body;
  if (!preferences || typeof preferences !== 'object') {
    throw new ExpressError('Preferences object is required', 400);
  }

  // Validate that only valid preference keys are being updated
  const validKeys = [
    'enabled',
    'bookingConfirmations',
    'bookingReminders',
    'bookingCancellations',
    'paymentReceipts',
    'payoutNotifications',
    'subscriptionUpdates',
    'promotionalEmails',
    'reviewRequests'
  ];

  const invalidKeys = Object.keys(preferences).filter(key => !validKeys.includes(key));
  if (invalidKeys.length > 0) {
    throw new ExpressError(`Invalid preference keys: ${invalidKeys.join(', ')}`, 400);
  }

  // Ensure all values are booleans
  for (const [key, value] of Object.entries(preferences)) {
    if (typeof value !== 'boolean') {
      throw new ExpressError(`Preference '${key}' must be a boolean`, 400);
    }
  }

  const updatedPreferences = await emailPreferencesService.updateEmailPreferences(userId, preferences);
  return updatedPreferences;
});

export default {
  createUser,
  getUserBySub,
  getUserByMerchantId,
  getUserStudios,
  addStudioToUser,
  removeStudioFromUser,
  getAllUsers,
  updateUser,
  deleteUser,
  getSavedCards,
  removeSavedCard,
  getEmailPreferences,
  updateEmailPreferences
};
