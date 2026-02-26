import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import type { ExtendedWebSocket } from "./socket.types.js";
import { createSocketRouter } from "./ws.router.js";
import { redisPublisher, redisSubscriber } from "../utils/redis/redisClient.js";
import { RoomModel } from "../modules/rooms/room.schema.js";
import { SocketEvent, SocketMessage } from "./socket.types.js";
import jwt from "jsonwebtoken";
import { parse } from "url";


// All room coordination is in Redis.

const connections = new Map<string, ExtendedWebSocket>(); 

// Redis pub/sub handles cross-instance broadcasting
const broadcastToRoom = (roomId: string, message: SocketMessage) => {
  for (const socket of connections.values()) {
    if (
      socket.currentRoom === roomId &&
      socket.readyState === WebSocket.OPEN
    ) {
      socket.send(JSON.stringify(message));
    }
  }
};

export const initWebSocketServer = (server: Server) => {
  const wss = new WebSocketServer({ noServer: true });


  server.on("upgrade", (request, socket, head) => {
    try {
      const { query } = parse(request.url || "", true);
      const token = query.token as string | undefined;

      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET!
      ) as { userId: string; isVerified: boolean };

      if (!decoded.isVerified) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      (request as any).user = decoded;

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  const { handleMessage } = createSocketRouter({ connections });

  // Redis pub/sub subscriber 
  redisSubscriber.pSubscribe("room:*", (message: string, channel: string) => {
    const roomId = channel.replace("room:", "").replace(":events", "");
    if (!roomId) return;

    const parsed = JSON.parse(message) as SocketMessage;
    broadcastToRoom(roomId, parsed);
  });


  setInterval(async () => {
    const now = new Date();
    const expiredRooms = await RoomModel.find({
      expiresAt: { $lte: now },
    }).lean();

    for (const room of expiredRooms) {
      const roomId = room.roomId;

      // Notify all instances via pub/sub
      await redisPublisher.publish(
        `room:${roomId}`,
        JSON.stringify({
          type: SocketEvent.ROOM_EXPIRED,
          payload: { roomId },
        })
      );

      // Clean up Redis keys
      await redisPublisher.del(`room:${roomId}:users`);
      await redisPublisher.del(`room:${roomId}:strokes`);
      await RoomModel.deleteOne({ roomId });
    }
  }, 30000);

  //  Connection lifecycle 
  wss.on("connection", (ws: WebSocket, request) => {
    const socket = ws as ExtendedWebSocket;

    socket.isAlive = true;
    socket.connectionId = randomUUID();
    socket.currentRoom = null;

    const user = (request as any).user as { userId: string };
    socket.userId = user.userId;

    // Register in local connections map
    connections.set(socket.connectionId, socket);
    console.log(`[WS] Connected: ${socket.connectionId} (user: ${socket.userId})`);

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", async (data: Buffer) => {
      await handleMessage(socket, data);
    });

    socket.on("close", async () => {
      const currentRoom = socket.currentRoom;

      // Always remove from local connections
      connections.delete(socket.connectionId);
      console.log(`[WS] Disconnected: ${socket.connectionId}`);

      if (!currentRoom) return;

      // Remove from Redis membership
      await redisPublisher.sRem(
        `room:${currentRoom}:users`,
        socket.connectionId
      );

      const count = await redisPublisher.sCard(`room:${currentRoom}:users`);

      // If room is now empty, set TTL 
      if (count === 0) {
        await redisPublisher.expire(`room:${currentRoom}:users`, 86400);
        await redisPublisher.expire(`room:${currentRoom}:strokes`, 86400);
        console.log(`[WS] Room ${currentRoom} is empty — TTL set to 24h`);
      }

      // Notify all instances via pub/sub
      await redisPublisher.publish(
        `room:${currentRoom}`,
        JSON.stringify({
          type: SocketEvent.USER_LEFT,
          payload: { roomId: currentRoom, userId: socket.userId },
        })
      );

      await redisPublisher.publish(
        `room:${currentRoom}`,
        JSON.stringify({
          type: SocketEvent.USER_COUNT_UPDATED,
          payload: { roomId: currentRoom, count },
        })
      );
    });
  });

  // Heartbeat 
  const interval = setInterval(() => {
    for (const socket of connections.values()) {
      if (!socket.isAlive) {
        console.log(`[WS] Terminating dead connection: ${socket.connectionId}`);
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);

  wss.on("close", () => clearInterval(interval));
};