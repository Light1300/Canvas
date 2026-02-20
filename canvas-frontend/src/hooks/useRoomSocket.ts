import { useEffect, useRef, useState, useCallback } from "react";
// import { Stroke } from "../modules/room/canvas/Canvas";
import { Stroke } from "../modules/room/canvas/canvas.types";


type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8080";

// Socket event constants matching backend socket.types.ts
const SocketEvent = {
  JOIN_ROOM: "JOIN_ROOM",
  CANVAS_UPDATE: "CANVAS_UPDATE",
  ROOM_EXPIRED: "ROOM_EXPIRED",
  USER_JOINED: "USER_JOINED",
  USER_LEFT: "USER_LEFT",
  USER_COUNT_UPDATED: "USER_COUNT_UPDATED",
} as const;

export function useRoomSocket(roomId: string) {
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

    const token = localStorage.getItem("accessToken");
    const url = token ? `${WS_URL}?token=${token}` : WS_URL;

    setConnectionStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      ws.send(
        JSON.stringify({
          type: SocketEvent.JOIN_ROOM,
          payload: { roomId },
        })
      );
    };

    ws.onmessage = (event) => {
      let msg: { type: string; payload: any };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case SocketEvent.USER_COUNT_UPDATED:
          setUserCount(msg.payload.count);
          break;

        case SocketEvent.CANVAS_UPDATE: {
          // Draw the incoming stroke on canvas
          const stroke = msg.payload.canvasData as Stroke;
          const canvas = document.querySelector("canvas") as any;
          if (canvas?.__drawStroke) {
            canvas.__drawStroke(stroke);
          }
          break;
        }

        case SocketEvent.ROOM_EXPIRED:
          setConnectionStatus("disconnected");
          ws.close();
          break;

        default:
          break;
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
    };

    ws.onerror = () => {
      setConnectionStatus("disconnected");
    };

    return () => {
      ws.close();
    };
  }, [roomId]);

  return { connectionStatus, userCount, sendStroke };
}