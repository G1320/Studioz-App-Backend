import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAggregateFromRatings, simulateRatingUpdate } from '../utils/reviewStats.js';

test('simulate rating update recalculates studio aggregates', () => {
  const existingRatings = [5, 4, 3];
  const initialAggregates = calculateAggregateFromRatings(existingRatings);

  assert.equal(initialAggregates.reviewCount, 3);
  assert.equal(initialAggregates.averageRating, 4);

  const updatedAggregates = simulateRatingUpdate(existingRatings, 1, 2);

  assert.equal(updatedAggregates.reviewCount, 3);
  assert.equal(updatedAggregates.averageRating, 3.33);
});

