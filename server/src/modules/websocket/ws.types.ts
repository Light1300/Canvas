import type { WebSocket } from "ws"

export enum SocketEvent {
  JOIN_ROOM = "JOIN_ROOM",
  LEAVE_ROOM = "LEAVE_ROOM",
  CANVAS_UPDATE = "CANVAS_UPDATE",
  USER_JOINED = "USER_JOINED",
  USER_LEFT = "USER_LEFT",
  USER_COUNT_UPDATED = "USER_COUNT_UPDATED"
}

export interface WSMessage<T = unknown> {
  type: SocketEvent
  payload: T
}

export interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean
  connectionId?: string
  userId?: string
}