import { WebSocket } from "ws";

export enum SocketEvent {
  JOIN_ROOM = "JOIN_ROOM",
  CANVAS_UPDATE = "CANVAS_UPDATE",
  INITIAL_STATE = "INITIAL_STATE",
  ROOM_EXPIRED = "ROOM_EXPIRED",
  USER_JOINED = "USER_JOINED",
  USER_LEFT = "USER_LEFT",
  USER_COUNT_UPDATED = "USER_COUNT_UPDATED",
}

export interface Stroke {
  roomId: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface JoinRoomPayload {
  roomId: string;
}

export interface CanvasUpdatePayload {
  roomId: string;
  canvasData: Stroke;
}

export interface InitialStatePayload {
  strokes: Stroke[];
}

export interface SocketMessage {
  type: SocketEvent;
  payload: any;
}

export interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  userId: string;
  connectionId: string;
  currentRoom: string | null;
}