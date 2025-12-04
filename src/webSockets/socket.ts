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

export const emitReservationUpdate = (reservationIds: string[], customerId:string) => {
  if (io) {
    io.emit('reservationUpdated', { reservationIds, customerId });
  }
}

export const emitNotification = (userId: string, notification: any) => {
  if (io) {
    // Emit to a specific user's room
    io.to(`user:${userId}`).emit('notification:new', { notification });
  }
}

export const emitNotificationCount = (userId: string, count: number) => {
  if (io) {
    // Emit unread count update to specific user
    io.to(`user:${userId}`).emit('notification:count', { count });
  }
}

// Helper to handle user socket connections
export const handleUserConnection = (socket: any, userId: string) => {
  // Join user-specific room for targeted notifications
  socket.join(`user:${userId}`);
  
  socket.on('disconnect', () => {
    socket.leave(`user:${userId}`);
  });
}

export default io;