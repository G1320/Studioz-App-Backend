import mongoose, { Error } from 'mongoose';
import  { DB_URL } from'../config/index.js';

const connectToDb = async () => {
  if (!DB_URL) {
    console.error('Database URL is not defined.');
    process.exit(1);
  }
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('Already connected to the database');
      return;
    }
    await mongoose.connect(DB_URL, { dbName: 'studios_db' });
    console.log('Database connected');
  } catch (error) {
    console.error('Connection error', error);
    process.exit(1);
  }
};

mongoose.connection.on('connected', () => console.log('Mongoose connected'));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));
mongoose.connection.on('reconnected', () => console.log('Mongoose reconnected'));
mongoose.connection.on('error', (err:Error) => console.log('Mongoose connection error:', err));

export default connectToDb;
