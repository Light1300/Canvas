export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";

// Simple store without zustand to avoid the missing dep error.
// State is managed via useRoomSocket hook directly.
// Keep this file as a shared type export only.

export interface RoomState {
  userCount: number;
  connectionStatus: ConnectionStatus;
}