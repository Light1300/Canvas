import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { validateRoomService } from "../modules/rooms/room.service.js";
import { redisPublisher, redisSubscriber } from "../utils/redis/redisClient.js";
import {
  CanvasUpdatePayload,
  JoinRoomPayload,
  SocketMessage
} from "./socket.types.js";

const rooms = new Map<string, Set<WebSocket>>();

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

  wss.on("connection", (ws: WebSocket) => {
    let currentRoom: string | null = null;

    ws.on("message", async (data: Buffer) => {
      const message: SocketMessage = JSON.parse(data.toString());

      if (message.type === "JOIN_ROOM") {
        const { roomId } = message.payload as JoinRoomPayload;

        const isValid = await validateRoomService(roomId);
        if (!isValid) {
          ws.close();
          return;
        }

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }

        rooms.get(roomId)!.add(ws);
        currentRoom = roomId;
      }

      if (message.type === "CANVAS_UPDATE") {
        const payload = message.payload as CanvasUpdatePayload;

        await redisPublisher.publish(
          `room:${payload.roomId}`,
          JSON.stringify(message)
        );
      }
    });

    ws.on("close", () => {
      if (currentRoom) {
        rooms.get(currentRoom)?.delete(ws);
      }
    });
  });

  redisSubscriber.pSubscribe(
    "room:*",
    (message: string, channel: string) => {
      const roomId = channel.split(":")[1];
      const parsed: SocketMessage = JSON.parse(message);
      //@ts-ignore
      broadcast(roomId, parsed);
    }
  );
};