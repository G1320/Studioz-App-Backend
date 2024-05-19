const { PORT, ALLOWED_ORIGINS, JWT_SECRET_KEY } = require('./config/index.js');
const { handleErrorMw, handleDbErrorMw, logRequestsMw } = require('./middleware');

const authRoutes = require('./api/routes/authRoutes');
const userRoutes = require('./api/routes/userRoutes');
const studioRoutes = require('./api/routes/studioRoutes');
const wishlistRoutes = require('./api/routes/wishlistRoutes');
const itemRoutes = require('./api/routes/itemRoutes.js');
const cartRoutes = require('./api/routes/cartRoutes');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const connectToDb = require('./db/mongoose');
const express = require('express');

const port = process.env.PORT || PORT;

connectToDb();

const app = express();
app.use(helmet());

const corsOptions = {
  origin: ALLOWED_ORIGINS,
  credentials: true,
};

app.use(cors(corsOptions));

app.use(mongoSanitize());
app.use(cookieParser(JWT_SECRET_KEY));
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/studios', studioRoutes);
app.use('/api/wishlists', wishlistRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/cart', cartRoutes);

app.use('/api/auth', authRoutes);

app.use(logRequestsMw);
app.use(handleDbErrorMw);
app.use(handleErrorMw);

app.get('/', (req, res) => {
  res.send('Welcome to the Studios API!');
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
