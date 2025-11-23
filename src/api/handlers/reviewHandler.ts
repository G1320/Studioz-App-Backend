import mongoose from 'mongoose';
import { Request } from 'express';
import handleRequest from '../../utils/requestHandler.js';
import ExpressError from '../../utils/expressError.js';
import { ReviewModel } from '../../models/reviewModel.js';
import { StudioModel } from '../../models/studioModel.js';
import { UserModel } from '../../models/userModel.js';
import { updateStudioReviewStats } from '../../utils/reviewStats.js';

interface AuthenticatedRequest extends Request {
  decodedJwt?: {
    sub?: string;
    [key: string]: unknown;
  };
}

const resolveAuthenticatedUser = async (req: AuthenticatedRequest) => {
  const userSub = req.decodedJwt?.sub;
  if (!userSub) {
    throw new ExpressError('Authentication required', 401);
  }

  const user = await UserModel.findOne({ sub: userSub });
  if (!user) {
    throw new ExpressError('User not found', 404);
  }

  return user;
};

const getStudioReviews = handleRequest(async (req: Request) => {
  const { studioId } = req.params;
  if (!studioId || !mongoose.Types.ObjectId.isValid(studioId)) {
    throw new ExpressError('Invalid studio ID', 400);
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Math.min(Number(req.query.limit) || 10, 100), 1);
  const skip = (page - 1) * limit;

  const [reviews, total, studio] = await Promise.all([
    ReviewModel.find({ studioId, isVisible: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name firstName lastName avatar'),
    ReviewModel.countDocuments({ studioId, isVisible: true }),
    StudioModel.findById(studioId).select('averageRating reviewCount')
  ]);

  // Return array of reviews to match client expectation
  return reviews;
});

const upsertReview = handleRequest(async (req: AuthenticatedRequest) => {
  const { studioId } = req.params;
  if (!studioId || !mongoose.Types.ObjectId.isValid(studioId)) {
    throw new ExpressError('Invalid studio ID', 400);
  }

  const studio = await StudioModel.findById(studioId);
  if (!studio) {
    throw new ExpressError('Studio not found', 404);
  }

  const user = await resolveAuthenticatedUser(req);
  const { rating, comment } = req.body;

  if (!rating) {
    throw new ExpressError('Rating is required', 400);
  }

  let review = await ReviewModel.findOne({ studioId, userId: user._id });
  const isNewReview = !review;

  if (!review) {
    review = new ReviewModel({
      studioId,
      userId: user._id,
      rating,
      comment
    });
  } else {
    review.rating = rating;
    if (comment !== undefined) {
      review.comment = comment;
    }
  }

  try {
    await review.save();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
      throw new ExpressError(
        'You have already submitted a review for this studio. Please update your existing review instead.',
        409
      );
    }
    throw error;
  }

  await review.populate('userId', 'name firstName lastName avatar');
  await updateStudioReviewStats(studioId);

  // Return just the review to match client expectation
  return review;
});

const updateReviewById = handleRequest(async (req: AuthenticatedRequest) => {
  const { reviewId } = req.params;
  if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ExpressError('Invalid review ID', 400);
  }

  const user = await resolveAuthenticatedUser(req);
  const { rating, comment } = req.body;

  const review = await ReviewModel.findById(reviewId);
  if (!review) {
    throw new ExpressError('Review not found', 404);
  }

  if (review.userId.toString() !== user._id.toString() && !user.isAdmin) {
    throw new ExpressError('You are not allowed to modify this review', 403);
  }

  // Only update fields that are provided
  if (rating !== undefined) {
    review.rating = rating;
  }
  if (comment !== undefined) {
    review.comment = comment;
  }

  await review.save();
  await review.populate('userId', 'name firstName lastName avatar');

  await updateStudioReviewStats(review.studioId.toString());

  // Return just the review to match client expectation
  return review;
});

const deleteReviewById = handleRequest(async (req: AuthenticatedRequest) => {
  const { reviewId } = req.params;
  if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new ExpressError('Invalid review ID', 400);
  }

  const user = await resolveAuthenticatedUser(req);
  const review = await ReviewModel.findById(reviewId);

  if (!review) {
    throw new ExpressError('Review not found', 404);
  }

  if (review.userId.toString() !== user._id.toString() && !user.isAdmin) {
    throw new ExpressError('You are not allowed to delete this review', 403);
  }

  await ReviewModel.findByIdAndDelete(reviewId);
  await updateStudioReviewStats(review.studioId.toString());

  // Return void to match client expectation
  return;
});

export default {
  getStudioReviews,
  upsertReview,
  updateReviewById,
  deleteReviewById
};

