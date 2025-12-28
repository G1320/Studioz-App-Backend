import { PORT, ALLOWED_ORIGINS, JWT_SECRET_KEY } from './config/index.js';
import { handleErrorMw, handleDbErrorMw, logRequestsMw } from './middleware/index.js';
import connectToDb from './db/mongoose.js';

import authRoutes from './api/routes/authRoutes.js';
import userRoutes from './api/routes/userRoutes.js';
import studioRoutes from './api/routes/studioRoutes.js';
import wishlistRoutes from './api/routes/wishlistRoutes.js';
import itemRoutes from './api/routes/itemRoutes.js';
import addOnRoutes from './api/routes/addOnRoutes.js';
import reviewRoutes from './api/routes/reviewRoutes.js';
import cartRoutes from './api/routes/cartRoutes.js';
import bookingRoutes from './api/routes/bookingRoutes.js';

import searchRoutes from './api/routes/searchRoutes.js';
import emailRoutes from './api/routes/emailRoutes.js';
import invoiceRoutes from './api/routes/invoiceRoutes.js';
import reservationRoutes from './api/routes/reservationRoutes.js';
import notificationRoutes from './api/routes/notificationRoutes.js';
import otpRoutes from './api/routes/otpRoutes.js';
import sumitRoutes from './api/routes/sumit/paymentRoutes.js';
import subscriptionRoutes from './api/routes/sumit/subscriptionRoutes.js';
import vendorRoutes from './api/routes/sumit/vendorRoutes.js';
import googleCalendarRoutes from './api/routes/googleCalendarRoutes.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import express, { type Application } from 'express';
import { initializeSocket } from './webSockets/socket.js';
import { createServer } from 'node:http';
import bodyParser from 'body-parser';
import { initializeReservationScheduler, stopReservationScheduler } from './workers/reservationScheduler.js';


try {
  await connectToDb();
  initializeReservationScheduler();
} catch (error) {
  console.error('Failed to initialize server:', error);
  process.exit(1);
}

const app: Application = express();
const httpServer = createServer(app);

const io = initializeSocket(httpServer);

const gracefulShutdown = async () => {  
  stopReservationScheduler();
  if (io) await io.close();
    await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: ["'self'"],
        defaultSrc: ["'self'", ...ALLOWED_ORIGINS],
        scriptSrc: ["'self'", ...ALLOWED_ORIGINS],
        connectSrc: ["'self'", ...ALLOWED_ORIGINS],
        workerSrc: ["'self'", 'blob:'],
        mediaSrc: ["'self'", ...ALLOWED_ORIGINS]
      }
    }
  })
);

const corsOptions = {
  origin: ALLOWED_ORIGINS,
  credentials: true
};

app.use(logRequestsMw);
app.use(bodyParser.json());

app.use(cors(corsOptions));

app.use(mongoSanitize());
app.use(cookieParser(JWT_SECRET_KEY));
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/studios', studioRoutes);
app.use('/api/wishlists', wishlistRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/add-ons', addOnRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);

app.use("/api/emails", emailRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/sumit', sumitRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/vendors', vendorRoutes);


app.use('/api/auth', authRoutes);
app.use('/api/auth/google/calendar', googleCalendarRoutes);

app.use(handleDbErrorMw);
app.use(handleErrorMw);

app.get('/', (req, res) => {
  res.send('Welcome to the Studioz.co.il API!');
});

httpServer.listen(PORT, () => {
  console.log(`HTTP Server is running on port ${PORT}`);
});

