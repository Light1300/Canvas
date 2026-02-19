import type { ExtendedWebSocket } from "./socket.types.js";
import {
  SocketEvent,
  SocketMessage,
  JoinRoomPayload,
  CanvasUpdatePayload
} from "./socket.types.js";
import { validateRoomService } from "../modules/rooms/room.service.js";
import { redisPublisher } from "../utils/redis/redisClient.js";

interface RouterDeps {
  rooms: Map<string, Set<ExtendedWebSocket>>;
}

export const createSocketRouter = ({ rooms }: RouterDeps) => {
  const handlers: Record<
    SocketEvent,
    (socket: ExtendedWebSocket, message: SocketMessage) => Promise<void>
  > = {
    async [SocketEvent.JOIN_ROOM](socket, message) {
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
      socket.currentRoom = roomId;

      await redisPublisher.sAdd(
        `room:users:${roomId}`,
        socket.connectionId!
      );

      const count = await redisPublisher.sCard(
        `room:users:${roomId}`
      );

      await redisPublisher.publish(
        `room:${roomId}`,
        JSON.stringify({
          type: SocketEvent.USER_JOINED,
          payload: { roomId, connectionId: socket.connectionId }
        })
      );

      await redisPublisher.publish(
        `room:${roomId}`,
        JSON.stringify({
          type: SocketEvent.USER_COUNT_UPDATED,
          payload: { roomId, count }
        })
      );
    },

    async [SocketEvent.CANVAS_UPDATE](socket, message) {
      const payload = message.payload as CanvasUpdatePayload;

      await redisPublisher.publish(
        `room:${payload.roomId}`,
        JSON.stringify(message)
      );
    },

    async [SocketEvent.ROOM_EXPIRED]() {},
    async [SocketEvent.USER_JOINED]() {},
    async [SocketEvent.USER_LEFT]() {},
    async [SocketEvent.USER_COUNT_UPDATED]() {}
  };

  const handleMessage = async (
    socket: ExtendedWebSocket,
    raw: Buffer
  ) => {
    let message: SocketMessage;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      socket.close();
      return;
    }

    const handler = handlers[message.type];

    if (!handler) {
      socket.close();
      return;
    }

    await handler(socket, message);
  };

  return { handleMessage };
};