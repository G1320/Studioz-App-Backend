import validateUser from './validation/validateUser.js';
import validateStudio from './validation/validateStudio.js';
import validateReview, { validateReviewCreate } from './validation/validateReview.js';
import validateItem from './validation/validateItem.js';
import logRequestsMw from './logging/logRequestsMw.js';
import handleDbErrorMw from './errorHandling/handleDbErrorMw.js';
import handleErrorMw from './errorHandling/handleErrorMw.js';
import verifyTokenMw from './auth/verifyTokenMw.js';
import verifyAdminMw from './auth/verifyAdminMw.js';

// Subscription middleware
export {
  requireSubscription,
  requireTier,
  requireFeature,
  checkPaymentLimit,
  checkListingLimit
} from './subscription/index.js';

export {
  validateUser,
  validateStudio,
  validateReview,
  validateReviewCreate,
  validateItem,
  logRequestsMw,
  handleDbErrorMw,
  handleErrorMw,
  verifyTokenMw,
  verifyAdminMw
};
