import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import bodyParser from 'body-parser';

// Import routes
import authRoutes from '../../api/routes/authRoutes.js';
import userRoutes from '../../api/routes/userRoutes.js';
import studioRoutes from '../../api/routes/studioRoutes.js';
import itemRoutes from '../../api/routes/itemRoutes.js';
import reservationRoutes from '../../api/routes/reservationRoutes.js';
import bookingRoutes from '../../api/routes/bookingRoutes.js';
import cartRoutes from '../../api/routes/cartRoutes.js';
import googleCalendarRoutes from '../../api/routes/googleCalendarRoutes.js';

// Import error handlers
import { handleErrorMw, handleDbErrorMw } from '../../middleware/index.js';

// Test JWT secret (consistent for testing)
const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing';

/**
 * Creates an Express app configured for testing
 * Does not start the server or connect to database
 */
export function createTestApp(): Application {
  const app = express();

  // Middleware
  app.use(bodyParser.json());
  app.use(express.json());
  app.use(mongoSanitize());
  app.use(cookieParser(TEST_JWT_SECRET));

  // Routes (add only what's needed for testing)
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/studios', studioRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/reservations', reservationRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/auth/google/calendar', googleCalendarRoutes);

  // Error handlers
  app.use(handleDbErrorMw);
  app.use(handleErrorMw);

  return app;
}

export { TEST_JWT_SECRET };
