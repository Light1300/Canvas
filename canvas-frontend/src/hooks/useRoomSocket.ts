import { useEffect, useRef, useState, useCallback } from "react";
import { Stroke } from "../modules/room/canvas/canvas.types";

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8080";

const SocketEvent = {
  JOIN_ROOM: "JOIN_ROOM",
  CANVAS_UPDATE: "CANVAS_UPDATE",
  INITIAL_STATE: "INITIAL_STATE",
  ROOM_EXPIRED: "ROOM_EXPIRED",
  USER_JOINED: "USER_JOINED",
  USER_LEFT: "USER_LEFT",
  USER_COUNT_UPDATED: "USER_COUNT_UPDATED",
} as const;

interface UseRoomSocketReturn {
  connectionStatus: ConnectionStatus;
  userCount: number;
  sendStroke: (stroke: Stroke) => void;
}

export function useRoomSocket(roomId: string): UseRoomSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [userCount, setUserCount] = useState(0);

  const sendStroke = useCallback((stroke: Stroke) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: SocketEvent.CANVAS_UPDATE,
          payload: {
            roomId: stroke.roomId,
            canvasData: stroke,
          },
        })
      );
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;

    // Prevent duplicate connections (StrictMode / double-mount guard)
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setConnectionStatus("disconnected");
      return;
    }

    const url = `${WS_URL}?token=${token}`;
    setConnectionStatus("connecting");

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      ws.send(JSON.stringify({
        type: SocketEvent.JOIN_ROOM,
        payload: { roomId },
      }));
    };

    ws.onmessage = (event) => {
      let msg: { type: string; payload: any };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {

        // Full history on join — replace entire canvas
        case SocketEvent.INITIAL_STATE: {
          const strokes = msg.payload.strokes as Stroke[];
          const canvas = document.querySelector("canvas") as any;
          if (canvas?.__replaceStrokes) {
            canvas.__replaceStrokes(strokes);
          }
          break;
        }

        // Incremental stroke from another user
        case SocketEvent.CANVAS_UPDATE: {
          const stroke = msg.payload.canvasData as Stroke;
          const canvas = document.querySelector("canvas") as any;
          if (canvas?.__drawStroke) {
            canvas.__drawStroke(stroke);
          }
          break;
        }

        case SocketEvent.USER_COUNT_UPDATED:
          setUserCount(msg.payload.count);
          break;

        case SocketEvent.ROOM_EXPIRED:
          setConnectionStatus("disconnected");
          ws.close();
          break;

        default:
          break;
      }
    };

    ws.onclose = () => setConnectionStatus("disconnected");
    ws.onerror = () => setConnectionStatus("disconnected");

    const handleBeforeUnload = () => ws.close();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      ws.close();
    };
  }, [roomId]);

  return { connectionStatus, userCount, sendStroke };
}