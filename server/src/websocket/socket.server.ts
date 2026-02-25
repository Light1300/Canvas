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

const rooms = new Map<string, Set<ExtendedWebSocket>>();

const broadcast = (roomId: string, message: SocketMessage) => {
  const clients = rooms.get(roomId);
  if (!clients) return;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
};

export const initWebSocketServer = (server: Server) => {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    console.log("Upgrade request received");

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
      ) as { userId: string , isVerified:boolean };
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

  const { handleMessage } = createSocketRouter({ rooms });

  redisSubscriber.pSubscribe("room:*", (message: string, channel: string) => {
    const roomId = channel.split(":")[1];
    if (!roomId) return;

    const parsed = JSON.parse(message) as SocketMessage;
    broadcast(roomId, parsed);
  });

  setInterval(async () => {
    const now = new Date();
    const expiredRooms = await RoomModel.find({
      expiresAt: { $lte: now },
    }).lean();

    for (const room of expiredRooms) {
      const roomId = room.roomId;

      await redisPublisher.publish(
        `room:${roomId}`,
        JSON.stringify({
          type: SocketEvent.ROOM_EXPIRED,
          payload: { roomId },
        })
      );

      const clients = rooms.get(roomId);
      if (clients) {
        for (const client of clients) client.close();
        rooms.delete(roomId);
      }

      await redisPublisher.del(`room:users:${roomId}`);
      await RoomModel.deleteOne({ roomId });
    }
  }, 30000);

  wss.on("connection", (ws: WebSocket, request) => {
    const socket = ws as ExtendedWebSocket;

    socket.isAlive = true;

    const user = (request as any).user as {
      userId: string;
    };

    socket.userId = user.userId;
    socket.connectionId = randomUUID(); 
    socket.currentRoom = null;

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", async (data: Buffer) => {
      await handleMessage(socket, data);
    });

    socket.on("close", async () => {
      const currentRoom = socket.currentRoom;
      if (!currentRoom) return;

      // Remove from in-memory room
      rooms.get(currentRoom)?.delete(socket);

      // Remove from Redis membership set
     await redisPublisher.sRem(
       `room:users:${currentRoom}`,
       socket.connectionId!  // ← this
     );

      const count = await redisPublisher.sCard(
        `room:users:${currentRoom}`
      );

      // Notify others user left
      await redisPublisher.publish(
        `room:${currentRoom}`,
        JSON.stringify({
          type: SocketEvent.USER_LEFT,
          payload: {
            roomId: currentRoom,
            userId: socket.userId,
          },
        })
      );

      // Update count
      await redisPublisher.publish(
        `room:${currentRoom}`,
        JSON.stringify({
          type: SocketEvent.USER_COUNT_UPDATED,
          payload: {
            roomId: currentRoom,
            count,
          },
        })
      );

      if (rooms.get(currentRoom)?.size === 0) {
        rooms.delete(currentRoom);
      }
    });
  });

  //  Heartbeat
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as ExtendedWebSocket;

      if (!socket.isAlive) {
        socket.terminate();
        return;
      }

      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));
};