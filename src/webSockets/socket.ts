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

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const emitAvailabilityUpdate = (itemId: string) => {
  if (io) {
    console.log('Emitting availability update for itemId:', itemId);
    io.emit('availabilityUpdated', { itemId });  // Changed to broadcast to all
  }
};

export default io;