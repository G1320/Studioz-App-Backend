/**
 * Subscription Middleware Exports
 * 
 * These middleware functions enforce subscription tier requirements on API routes.
 * 
 * @example
 * import { requireFeature, checkPaymentLimit } from '../middleware/subscription';
 * 
 * // Require specific feature
 * router.post('/charge', requireFeature('payments'), handler);
 * 
 * // Require minimum tier
 * router.get('/pro-dashboard', requireTier('pro'), handler);
 * 
 * // Check usage limits
 * router.post('/items', checkListingLimit, handler);
 * 
 * // Combine multiple checks
 * router.post('/charge', 
 *   requireFeature('payments'), 
 *   checkPaymentLimit, 
 *   handler
 * );
 */

export { requireSubscription } from './requireSubscription.js';
export { requireTier } from './requireTier.js';
export { requireFeature } from './requireFeature.js';
export { checkPaymentLimit } from './checkPaymentLimit.js';
export { checkListingLimit } from './checkListingLimit.js';
