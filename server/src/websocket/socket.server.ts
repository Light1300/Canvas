import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import type { ExtendedWebSocket } from "./socket.types.js";
import { createSocketRouter } from "./ws.router.js";
import { redisPublisher, redisSubscriber } from "../utils/redis/redisClient.js";
import { RoomModel } from "../modules/rooms/room.schema.js";
import { SocketEvent, SocketMessage } from "./socket.types.js";
import { getUserColor } from "../utils/user-colors.js";
import jwt from "jsonwebtoken";
import { parse } from "url";

const connections = new Map<string, ExtendedWebSocket>();

const broadcastToRoom = (roomId: string, message: SocketMessage) => {
  for (const socket of connections.values()) {
    if (socket.currentRoom === roomId && socket.readyState === WebSocket.OPEN) {
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
      ) as { userId: string; isVerified: boolean; email: string; name: string };

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

  redisSubscriber.pSubscribe("room:*", (message: string, channel: string) => {
    const roomId = channel.replace("room:", "").replace(":events", "");
    if (!roomId) return;
    const parsed = JSON.parse(message) as SocketMessage;
    broadcastToRoom(roomId, parsed);
  });

  setInterval(async () => {
    const now = new Date();
    const expiredRooms = await RoomModel.find({ expiresAt: { $lte: now } }).lean();
    for (const room of expiredRooms) {
      const roomId = room.roomId;
      await redisPublisher.publish(`room:${roomId}`, JSON.stringify({ type: SocketEvent.ROOM_EXPIRED, payload: { roomId } }));
      await redisPublisher.del(`room:${roomId}:users`);
      await redisPublisher.del(`room:${roomId}:strokes`);
      await RoomModel.deleteOne({ roomId });
    }
  }, 30000);

  wss.on("connection", (ws: WebSocket, request) => {
    const socket = ws as ExtendedWebSocket;
    const user = (request as any).user as { userId: string; email: string; name: string };

    socket.isAlive = true;
    socket.connectionId = randomUUID();
    socket.currentRoom = null;
    socket.userId = user.userId;
    socket.username = user.name;
    socket.color = getUserColor(user.userId);

    connections.set(socket.connectionId, socket);
    console.log(`[WS] Connected: ${socket.connectionId} (${socket.username})`);

    socket.on("pong", () => { socket.isAlive = true; });
    socket.on("message", async (data: Buffer) => { await handleMessage(socket, data); });

    socket.on("close", async () => {
      connections.delete(socket.connectionId);
      const currentRoom = socket.currentRoom;
      if (!currentRoom) return;

      await redisPublisher.sRem(`room:${currentRoom}:users`, socket.connectionId);
      const count = await redisPublisher.sCard(`room:${currentRoom}:users`);

      if (count === 0) {
        await redisPublisher.expire(`room:${currentRoom}:users`, 86400);
        await redisPublisher.expire(`room:${currentRoom}:strokes`, 86400);
      }

      await redisPublisher.publish(`room:${currentRoom}`, JSON.stringify({ type: SocketEvent.CURSOR_LEAVE, payload: { roomId: currentRoom, userId: socket.userId } }));
      await redisPublisher.publish(`room:${currentRoom}`, JSON.stringify({ type: SocketEvent.USER_LEFT, payload: { roomId: currentRoom, userId: socket.userId } }));
      await redisPublisher.publish(`room:${currentRoom}`, JSON.stringify({ type: SocketEvent.USER_COUNT_UPDATED, payload: { roomId: currentRoom, count } }));
    });
  });

  const interval = setInterval(() => {
    for (const socket of connections.values()) {
      if (!socket.isAlive) { socket.terminate(); return; }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);

  wss.on("close", () => clearInterval(interval));
};