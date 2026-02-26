import type { WebSocket } from "ws";

export enum SocketEvent {
  JOIN_ROOM = "JOIN_ROOM",
  LEAVE_ROOM = "LEAVE_ROOM",
  CANVAS_UPDATE = "CANVAS_UPDATE",
  INITIAL_STATE = "INITIAL_STATE",
  CURSOR_MOVE = "CURSOR_MOVE",
  CURSOR_LEAVE = "CURSOR_LEAVE",
  UNDO = "UNDO",
  REDO = "REDO",
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
  strokeId: string;   
  userId: string;     
}

export interface SocketMessage<T = unknown> {
  type: SocketEvent;
  payload: T;
}

export interface JoinRoomPayload {
  roomId: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface CanvasUpdatePayload {
  roomId: string;
  canvasData: Stroke;
}

export interface CursorMovePayload {
  roomId: string;
  x: number;
  y: number;
  userId: string;
  username: string;
  color: string;
}

export interface CursorLeavePayload {
  roomId: string;
  userId: string;
}

export interface UndoPayload {
  roomId: string;
  userId: string;
  strokeId: string;   
}

export interface RedoPayload {
  roomId: string;
  userId: string;
  stroke: Stroke;     
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
  isAlive: boolean;
  connectionId: string;
  currentRoom: string | null;
  userId: string;
  username: string;
  color: string;        
}