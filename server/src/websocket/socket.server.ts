import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { ExtendedWebSocket } from "./socket.types.js";
import { randomUUID } from "crypto";
import { validateRoomService } from "../modules/rooms/room.service.js";
import { redisPublisher, redisSubscriber } from "../utils/redis/redisClient.js";
import {
  CanvasUpdatePayload,
  JoinRoomPayload,
  SocketMessage,
  SocketEvent
} from "./socket.types.js";
import { createSocketRouter } from "./ws.router.js";
import { RoomModel } from "../modules/rooms/room.schema.js";

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
  // Redis PubSub listener
  redisSubscriber.pSubscribe("room:*", (message: string, channel: string) => {
    const roomId = channel.split(":")[1];
    const parsed = JSON.parse(message) as SocketMessage;
    //@ts-ignore
    broadcast(roomId, parsed);
  });

  // Expiry watcher
  setInterval(async () => {
    const now = new Date();

    const expiredRooms = await RoomModel.find({
      expiresAt: { $lte: now }
    }).lean();

    for (const room of expiredRooms) {
      const roomId = room.roomId;

      await redisPublisher.publish(
        `room:${roomId}`,
        JSON.stringify({
          type: SocketEvent.ROOM_EXPIRED,
          payload: { roomId }
        })
      );

      const clients = rooms.get(roomId);
      if (clients) {
        for (const client of clients) {
          client.close();
        }
        rooms.delete(roomId);
      }

      await redisPublisher.del(`room:users:${roomId}`);
      await RoomModel.deleteOne({ roomId });
    }
  }, 30000);

  // Heartbeat
  wss.on("connection", (ws: WebSocket) => {
    const socket = ws as ExtendedWebSocket;
    socket.isAlive = true;

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    const connectionId = randomUUID();
    let currentRoom: string | null = null;

    socket.on("message", async (data: Buffer) => {
      await handleMessage(socket, data);

      let message: SocketMessage;

      try {
        message = JSON.parse(data.toString());
      } catch {
        socket.close();
        return;
      }

      if (message.type === SocketEvent.JOIN_ROOM) {
        const { roomId } = message.payload as JoinRoomPayload;

        const isValid = await validateRoomService(roomId);
        if (!isValid) {
          socket.close();
          return;
        }

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }

        rooms.get(roomId)!.add(socket);
        currentRoom = roomId;

        await redisPublisher.sAdd(
          `room:users:${roomId}`,
          connectionId
        );

        const count = await redisPublisher.sCard(
          `room:users:${roomId}`
        );

        await redisPublisher.publish(
          `room:${roomId}`,
          JSON.stringify({
            type: SocketEvent.USER_JOINED,
            payload: { roomId, connectionId }
          })
        );

        await redisPublisher.publish(
          `room:${roomId}`,
          JSON.stringify({
            type: SocketEvent.USER_COUNT_UPDATED,
            payload: { roomId, count }
          })
        );
      }

      if (message.type === SocketEvent.CANVAS_UPDATE) {
        const payload = message.payload as CanvasUpdatePayload;

        await redisPublisher.publish(
          `room:${payload.roomId}`,
          JSON.stringify(message)
        );
      }
    });

    socket.on("close", async () => {
      if (!currentRoom) return;

      rooms.get(currentRoom)?.delete(socket);

      await redisPublisher.sRem(
        `room:users:${currentRoom}`,
        connectionId
      );

      const count = await redisPublisher.sCard(
        `room:users:${currentRoom}`
      );

      await redisPublisher.publish(
        `room:${currentRoom}`,
        JSON.stringify({
          type: SocketEvent.USER_LEFT,
          payload: { roomId: currentRoom, connectionId }
        })
      );

      await redisPublisher.publish(
        `room:${currentRoom}`,
        JSON.stringify({
          type: SocketEvent.USER_COUNT_UPDATED,
          payload: { roomId: currentRoom, count }
        })
      );

      if (rooms.get(currentRoom)?.size === 0) {
        rooms.delete(currentRoom);
      }
    });
  });

  // Global heartbeat interval
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

  wss.on("close", () => {
    clearInterval(interval);
  });
};