import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import cookieSignature from 'cookie-signature';
import { ALLOWED_ORIGINS, JWT_SECRET_KEY } from '../config/index.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

let io: Server | null = null;

/**
 * Extract JWT from socket handshake (cookie, auth object, or Authorization header).
 */
const extractToken = (socket: Socket): string | null => {
  // 1. Auth object from client (socket.io auth option)
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }

  // 2. Signed cookie from request headers
  if (socket.handshake.headers.cookie) {
    const cookieHeader = socket.handshake.headers.cookie;
    const match = cookieHeader.match(/accessToken=([^;]+)/);
    if (match) {
      const raw = decodeURIComponent(match[1]);
      // Signed cookies from cookie-parser start with "s:"
      if (raw.startsWith('s:')) {
        const unsigned = cookieSignature.unsign(raw.slice(2), JWT_SECRET_KEY as string);
        if (unsigned !== false) return unsigned;
      } else {
        return raw;
      }
    }
  }

  // 3. Authorization header
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
};

export const initializeSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/socket.io/'
  });

  // JWT authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token = extractToken(socket);

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, JWT_SECRET_KEY as Secret) as JwtPayload;
      socket.userId = decoded.userId || decoded._id || decoded.sub;

      if (!socket.userId) {
        return next(new Error('Invalid token payload'));
      }

      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // Handle authenticated socket connections
  io.on('connection', (socket: AuthenticatedSocket) => {
    const authenticatedUserId = socket.userId;

    // Auto-join the authenticated user's room
    if (authenticatedUserId) {
      socket.join(`user:${authenticatedUserId}`);
    }

    // Verify userId matches on explicit room join (prevents impersonation)
    socket.on('join:user', (data: { userId: string }) => {
      if (data.userId && data.userId === authenticatedUserId) {
        socket.join(`user:${data.userId}`);
      }
    });

    socket.on('disconnect', () => {
      // Socket automatically leaves all rooms on disconnect
    });
  });

  return io;
};

/**
 * Emit availability update for a single item (instant - for normal bookings)
 */
export const emitAvailabilityUpdate = (itemId: string) => {
  if (io) {
    io.emit('availabilityUpdated', { itemId }); 
  }
};

/**
 * Emit availability update for multiple items at once (for batch operations like calendar sync)
 * This prevents flooding the frontend with multiple events
 */
export const emitBulkAvailabilityUpdate = (itemIds: string[]) => {
  if (io && itemIds.length > 0) {
    // Emit a single event with all item IDs
    io.emit('availabilityUpdated', { itemIds, itemId: itemIds[0] });
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
};

/** Notify customer and vendor to refresh project chat (multi-tab safe). */
export const emitProjectMessageUpdate = (
  customerId: string,
  vendorId: string,
  projectId: string
) => {
  if (io) {
    const payload = { projectId };
    io.to(`user:${customerId}`).emit('project:message', payload);
    io.to(`user:${vendorId}`).emit('project:message', payload);
  }
};

/** Notify customer and vendor that the project status changed. */
export const emitProjectStatusUpdate = (
  customerId: string,
  vendorId: string,
  projectId: string,
  status: string
) => {
  if (io) {
    const payload = { projectId, status };
    io.to(`user:${customerId}`).emit('project:status', payload);
    io.to(`user:${vendorId}`).emit('project:status', payload);
  }
};

/** Notify customer and vendor to refresh project file list. */
export const emitProjectFileUpdate = (
  customerId: string,
  vendorId: string,
  projectId: string
) => {
  if (io) {
    const payload = { projectId };
    io.to(`user:${customerId}`).emit('project:files', payload);
    io.to(`user:${vendorId}`).emit('project:files', payload);
  }
};

// Helper to handle user socket connections
export const handleUserConnection = (socket: any, userId: string) => {
  // Join user-specific room for targeted notifications
  socket.join(`user:${userId}`);
  
  socket.on('disconnect', () => {
    socket.leave(`user:${userId}`);
  });
}

export default io;