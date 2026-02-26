import { WebSocket } from "ws";
import type { ExtendedWebSocket } from "./socket.types.js";
import {
  SocketEvent,
  SocketMessage,
  JoinRoomPayload,
  LeaveRoomPayload,
  CanvasUpdatePayload,
  CursorMovePayload,
  UndoPayload,
  RedoPayload,
  Stroke,
} from "./socket.types.js";
import { validateRoomService } from "../modules/rooms/room.service.js";
import { redisPublisher } from "../utils/redis/redisClient.js";

const keys = {
  users: (roomId: string) => `room:${roomId}:users`,
  strokes: (roomId: string) => `room:${roomId}:strokes`,
  events: (roomId: string) => `room:${roomId}`,
};

const ROOM_TTL = 86400;

interface RouterDeps {
  connections: Map<string, ExtendedWebSocket>;
}

// Helper: remove a specific strokeId from Redis stroke list
const removeStrokeById = async (roomId: string, strokeId: string): Promise<Stroke | null> => {
  const raw = await redisPublisher.lRange(keys.strokes(roomId), 0, -1);
  const strokes: Stroke[] = raw.map((s) => JSON.parse(s));
  const target = strokes.find((s) => s.strokeId === strokeId);
  if (!target) return null;
  await redisPublisher.lRem(keys.strokes(roomId), 0, JSON.stringify(target));
  return target;
};

export const createSocketRouter = ({ connections }: RouterDeps) => {

  const handlers: Record<
    string,
    (socket: ExtendedWebSocket, message: SocketMessage) => Promise<void>
  > = {

    async [SocketEvent.JOIN_ROOM](socket, message) {
      const { roomId } = message.payload as JoinRoomPayload;

      // Reconcile stale Redis entries
      const existingMembers = await redisPublisher.sMembers(keys.users(roomId));
      for (const memberId of existingMembers) {
        if (!connections.has(memberId)) {
          await redisPublisher.sRem(keys.users(roomId), memberId);
        }
      }

      const isValid = await validateRoomService(roomId);
      if (!isValid) {
        socket.send(JSON.stringify({ type: SocketEvent.ROOM_EXPIRED, payload: { roomId } }));
        socket.close();
        return;
      }

      socket.currentRoom = roomId;
      await redisPublisher.sAdd(keys.users(roomId), socket.connectionId);

      const rawStrokes = await redisPublisher.lRange(keys.strokes(roomId), 0, -1);
      const strokes: Stroke[] = rawStrokes.map((s) => JSON.parse(s));

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: SocketEvent.INITIAL_STATE,
          payload: { strokes },
        }));
      }

      const count = await redisPublisher.sCard(keys.users(roomId));

      await redisPublisher.publish(keys.events(roomId), JSON.stringify({
        type: SocketEvent.USER_JOINED,
        payload: {
          roomId,
          userId: socket.userId,
          username: socket.username,
          color: socket.color,
        },
      }));

      await redisPublisher.publish(keys.events(roomId), JSON.stringify({
        type: SocketEvent.USER_COUNT_UPDATED,
        payload: { roomId, count },
      }));

      console.log(`[WS] ${socket.username} joined room ${roomId} — ${count} online`);
    },

    async [SocketEvent.LEAVE_ROOM](socket, message) {
      const { roomId } = message.payload as LeaveRoomPayload;

      socket.currentRoom = null;

      await redisPublisher.sRem(keys.users(roomId), socket.connectionId);

      const count = await redisPublisher.sCard(keys.users(roomId));

      if (count === 0) {
        await redisPublisher.expire(keys.users(roomId), ROOM_TTL);
        await redisPublisher.expire(keys.strokes(roomId), ROOM_TTL);
      }

      await redisPublisher.publish(keys.events(roomId), JSON.stringify({
        type: SocketEvent.CURSOR_LEAVE,
        payload: { roomId, userId: socket.userId },
      }));

      await redisPublisher.publish(keys.events(roomId), JSON.stringify({
        type: SocketEvent.USER_LEFT,
        payload: { roomId, userId: socket.userId },
      }));

      await redisPublisher.publish(keys.events(roomId), JSON.stringify({
        type: SocketEvent.USER_COUNT_UPDATED,
        payload: { roomId, count },
      }));

      console.log(`[WS] ${socket.username} explicitly left room ${roomId}`);
    },

    async [SocketEvent.CANVAS_UPDATE](_socket, message) {
      const payload = message.payload as CanvasUpdatePayload;
      const { roomId, canvasData: stroke } = payload;

      await redisPublisher.rPush(keys.strokes(roomId), JSON.stringify(stroke));
      await redisPublisher.expire(keys.strokes(roomId), ROOM_TTL);
      await redisPublisher.expire(keys.users(roomId), ROOM_TTL);

      await redisPublisher.publish(keys.events(roomId), JSON.stringify(message));
    },

    async [SocketEvent.CURSOR_MOVE](socket, message) {
      const payload = message.payload as CursorMovePayload;

      await redisPublisher.publish(keys.events(payload.roomId), JSON.stringify({
        type: SocketEvent.CURSOR_MOVE,
        payload: {
          ...payload,
          userId: socket.userId,
          username: socket.username,
          color: socket.color,
        },
      }));
    },

        async [SocketEvent.UNDO](socket, message) {
      const { roomId, strokeId } = message.payload as UndoPayload;

      
      const removed = await removeStrokeById(roomId, strokeId);

      if (!removed) return; 

      // Verify ownership
      if (removed.userId !== socket.userId) {
        // user tried to undo someone else's stroke
        await redisPublisher.rPush(keys.strokes(roomId), JSON.stringify(removed));
        return;
      }

      await redisPublisher.publish(keys.events(roomId), JSON.stringify({
        type: SocketEvent.UNDO,
        payload: { roomId, userId: socket.userId, strokeId },
      }));
    },

    async [SocketEvent.REDO](socket, message) {
      const { roomId, stroke } = message.payload as RedoPayload;

      if (stroke.userId !== socket.userId) return; 

      await redisPublisher.rPush(keys.strokes(roomId), JSON.stringify(stroke));
      await redisPublisher.expire(keys.strokes(roomId), ROOM_TTL);

      await redisPublisher.publish(keys.events(roomId), JSON.stringify({
        type: SocketEvent.REDO,
        payload: { roomId, userId: socket.userId, stroke },
      }));
    },

    async [SocketEvent.ROOM_EXPIRED]() {},
    async [SocketEvent.USER_JOINED]() {},
    async [SocketEvent.USER_LEFT]() {},
    async [SocketEvent.USER_COUNT_UPDATED]() {},
    async [SocketEvent.INITIAL_STATE]() {},
    async [SocketEvent.CURSOR_LEAVE]() {},
  };

  const handleMessage = async (socket: ExtendedWebSocket, raw: Buffer) => {
    let message: SocketMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    const handler = handlers[message.type];
    if (!handler) return;
    await handler(socket, message);
  };

  return { handleMessage };
};