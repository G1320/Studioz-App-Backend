import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { ALLOWED_ORIGINS } from '../config/index.js';

let io: Server | null = null;

export const initializeSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/socket.io/'
  });

  return io;
};

export const emitAvailabilityUpdate = (itemId: string) => {
  if (io) {
    io.emit('availabilityUpdated', { itemId }); 
  }
};

export default io;