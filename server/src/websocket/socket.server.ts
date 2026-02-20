import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import type { ExtendedWebSocket } from "./socket.types.js";
import { createSocketRouter } from "./ws.router.js";
import { redisPublisher, redisSubscriber } from "../utils/redis/redisClient.js";
import { RoomModel } from "../modules/rooms/room.schema.js";
import { SocketEvent, SocketMessage } from "./socket.types.js";

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
  const wss = new WebSocketServer({ server });
  const { handleMessage } = createSocketRouter({ rooms });

  // Redis PubSub — broadcast to local room clients
  redisSubscriber.pSubscribe("room:*", (message: string, channel: string) => {
    const roomId = channel.split(":")[1];
    if (!roomId) return; // guard against malformed channel
    const parsed = JSON.parse(message) as SocketMessage;
    broadcast(roomId, parsed);
  });

  // Room expiry watcher
  setInterval(async () => {
    const now = new Date();
    const expiredRooms = await RoomModel.find({ expiresAt: { $lte: now } }).lean();

    for (const room of expiredRooms) {
      const roomId = room.roomId;

      await redisPublisher.publish(
        `room:${roomId}`,
        JSON.stringify({ type: SocketEvent.ROOM_EXPIRED, payload: { roomId } })
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

  wss.on("connection", (ws: WebSocket) => {
    const socket = ws as ExtendedWebSocket;

    socket.isAlive = true;
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

      rooms.get(currentRoom)?.delete(socket);

      await redisPublisher.sRem(`room:users:${currentRoom}`, socket.connectionId!);
      const count = await redisPublisher.sCard(`room:users:${currentRoom}`);

      await redisPublisher.publish(
        `room:${currentRoom}`,
        JSON.stringify({
          type: SocketEvent.USER_LEFT,
          payload: { roomId: currentRoom, connectionId: socket.connectionId },
        })
      );

      await redisPublisher.publish(
        `room:${currentRoom}`,
        JSON.stringify({
          type: SocketEvent.USER_COUNT_UPDATED,
          payload: { roomId: currentRoom, count },
        })
      );

      if (rooms.get(currentRoom)?.size === 0) {
        rooms.delete(currentRoom);
      }
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as unknown as ExtendedWebSocket;
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