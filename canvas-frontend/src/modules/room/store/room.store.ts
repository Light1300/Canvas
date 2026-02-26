export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";


export interface RoomState {
  userCount: number;
  connectionStatus: ConnectionStatus;
}