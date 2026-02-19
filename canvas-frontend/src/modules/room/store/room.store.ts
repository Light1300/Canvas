import { create } from "zustand";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

interface RoomState {
  userCount: number;
  connectionStatus: ConnectionStatus;
  setUserCount: (count: number) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  userCount: 0,
  connectionStatus: "idle",
  setUserCount: (count) => set({ userCount: count }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));