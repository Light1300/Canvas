import type { WebSocket } from "ws";

export enum SocketEvent {
  JOIN_ROOM = "JOIN_ROOM",
  CANVAS_UPDATE = "CANVAS_UPDATE",
  ROOM_EXPIRED = "ROOM_EXPIRED",

  USER_JOINED = "USER_JOINED",
  USER_LEFT = "USER_LEFT",
  USER_COUNT_UPDATED = "USER_COUNT_UPDATED"
}

export interface SocketMessage<T = unknown> {
  type: SocketEvent;
  payload: T;
}

export interface JoinRoomPayload {
  roomId: string;
}

export interface CanvasUpdatePayload {
  roomId: string;
  canvasData: unknown;
}

export interface PresencePayload {
  roomId: string;
  connectionId: string;
}

export interface UserCountPayload {
  roomId: string;
  count: number;
}

export interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  connectionId?: string;
  currentRoom?: string | null;
  userId: string;
}