import mongoose from 'mongoose';
import { ReviewModel } from '../models/reviewModel.js';
import { StudioModel } from '../models/studioModel.js';

export interface ReviewAggregate {
  averageRating: number;
  reviewCount: number;
}

export const calculateAggregateFromRatings = (ratings: number[]): ReviewAggregate => {
  if (!ratings.length) {
    return { averageRating: 0, reviewCount: 0 };
  }

  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  const reviewCount = ratings.length;
  const averageRating = Number((total / reviewCount).toFixed(2));

  return { averageRating, reviewCount };
};

export const simulateRatingUpdate = (
  ratings: number[],
  reviewIndex: number,
  updatedRating: number
): ReviewAggregate => {
  if (ratings.length === 0) {
    throw new Error('No reviews available to update');
  }
  if (reviewIndex < 0 || reviewIndex >= ratings.length) {
    throw new Error('Invalid review index provided');
  }

  const nextRatings = [...ratings];
  nextRatings[reviewIndex] = updatedRating;

  return calculateAggregateFromRatings(nextRatings);
};

export const updateStudioReviewStats = async (studioId: string): Promise<ReviewAggregate> => {
  if (!mongoose.Types.ObjectId.isValid(studioId)) {
    return { averageRating: 0, reviewCount: 0 };
  }

  const [stats] = await ReviewModel.aggregate([
    { $match: { studioId: new mongoose.Types.ObjectId(studioId), isVisible: true } },
    {
      $group: {
        _id: '$studioId',
        reviewCount: { $sum: 1 },
        averageRating: { $avg: '$rating' }
      }
    }
  ]);

  const aggregate: ReviewAggregate = {
    averageRating: stats?.reviewCount ? Number(stats.averageRating.toFixed(2)) : 0,
    reviewCount: stats?.reviewCount ?? 0
  };

  await StudioModel.findByIdAndUpdate(
    studioId,
    {
      averageRating: aggregate.averageRating,
      reviewCount: aggregate.reviewCount
    },
    { new: true }
  );

  return aggregate;
};

