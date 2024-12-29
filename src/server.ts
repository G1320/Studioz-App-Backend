import { PORT, ALLOWED_ORIGINS, JWT_SECRET_KEY } from './config/index.js';
import { handleErrorMw, handleDbErrorMw, logRequestsMw } from './middleware/index.js';
import connectToDb from './db/mongoose.js';

import authRoutes from './api/routes/authRoutes.js';
import userRoutes from './api/routes/userRoutes.js';
import studioRoutes from './api/routes/studioRoutes.js';
import wishlistRoutes from './api/routes/wishlistRoutes.js';
import itemRoutes from './api/routes/itemRoutes.js';
import cartRoutes from './api/routes/cartRoutes.js';
import bookingRoutes from './api/routes/bookingRoutes.js';
import PPOrderRoutes from './api/routes/PPOrderRoutes.js';
import PPAuthRoutes from './api/routes/PPAuthRoutes.js';
import PPOnboardingRoutes from './api/routes/PPOnboardingRoutes.js';
import searchRoutes from './api/routes/searchRoutes.js';
import emailRoutes from './api/routes/emailRoutes.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import express, { type Application } from 'express';
import { initializeSocket } from './webSockets/socket.js';
import { createServer } from 'node:http';
import bodyParser from 'body-parser';

connectToDb();

const app: Application = express();
const httpServer = createServer(app);

const io = initializeSocket(httpServer);

process.on('SIGINT', () => {
  io ? io.close(() => process.exit(0)) : process.exit(0);
});

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
app.use('/api/cart', cartRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/search', searchRoutes);
app.use("/api/PPAuth", PPAuthRoutes);
app.use("/api/PPorders", PPOrderRoutes);
app.use("/api/PPOnboarding", PPOnboardingRoutes);
app.use("/api/emails", emailRoutes);


app.use('/api/auth', authRoutes);

app.use(handleDbErrorMw);
app.use(handleErrorMw);

app.get('/', (req, res) => {
  res.send('Welcome to the Studioz.co.il API!');
});

httpServer.listen(PORT, () => {
  console.log(`HTTP Server is running on port ${PORT}`);
});

