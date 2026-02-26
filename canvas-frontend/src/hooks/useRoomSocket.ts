import { useEffect, useRef, useState, useCallback } from "react";
import { Stroke } from "../modules/room/canvas/canvas.types";

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

export interface CursorPosition {
  userId: string;
  username: string;
  color: string;
  x: number;
  y: number;
}

const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8080";

const SocketEvent = {
  JOIN_ROOM: "JOIN_ROOM",
  LEAVE_ROOM: "LEAVE_ROOM",
  CANVAS_UPDATE: "CANVAS_UPDATE",
  INITIAL_STATE: "INITIAL_STATE",
  CURSOR_MOVE: "CURSOR_MOVE",
  CURSOR_LEAVE: "CURSOR_LEAVE",
  UNDO: "UNDO",
  REDO: "REDO",
  ROOM_EXPIRED: "ROOM_EXPIRED",
  USER_JOINED: "USER_JOINED",
  USER_LEFT: "USER_LEFT",
  USER_COUNT_UPDATED: "USER_COUNT_UPDATED",
} as const;

const CURSOR_THROTTLE_MS = 50; // max 20 cursor 

export function useRoomSocket(roomId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const lastCursorSend = useRef<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [userCount, setUserCount] = useState(0);
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());

  const sendStroke = useCallback((stroke: Stroke) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: SocketEvent.CANVAS_UPDATE,
        payload: { roomId: stroke.roomId, canvasData: stroke },
      }));
    }
  }, []);

  // never saturates the WS
  const sendCursorMove = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorSend.current < CURSOR_THROTTLE_MS) return;
    lastCursorSend.current = now;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: SocketEvent.CURSOR_MOVE,
        payload: { roomId, x, y },
      }));
    }
  }, [roomId]);

  //  explicit leave
  const leaveRoom = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: SocketEvent.LEAVE_ROOM,
        payload: { roomId },
      }));
    }
  }, [roomId]);

  //  undo
  const sendUndo = useCallback((strokeId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: SocketEvent.UNDO,
        payload: { roomId, strokeId },
      }));
    }
  }, [roomId]);

  // redo
  const sendRedo = useCallback((stroke: Stroke) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: SocketEvent.REDO,
        payload: { roomId, stroke },
      }));
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      setConnectionStatus("disconnected");
      return;
    }

    setConnectionStatus("connecting");
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
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
      try { msg = JSON.parse(event.data); } catch { return; }

      switch (msg.type) {

        case SocketEvent.INITIAL_STATE: {
          const strokes = msg.payload.strokes as Stroke[];
          const canvas = document.querySelector("canvas") as any;
          if (canvas?.__replaceStrokes) canvas.__replaceStrokes(strokes);
          break;
        }

        case SocketEvent.CANVAS_UPDATE: {
          const stroke = msg.payload.canvasData as Stroke;
          const canvas = document.querySelector("canvas") as any;
          if (canvas?.__drawStroke) canvas.__drawStroke(stroke);
          break;
        }

        //render other users' cursors
        case SocketEvent.CURSOR_MOVE: {
          const { userId, username, color, x, y } = msg.payload;
          setCursors((prev) => {
            const next = new Map(prev);
            next.set(userId, { userId, username, color, x, y });
            return next;
          });
          break;
        }

        case SocketEvent.CURSOR_LEAVE: {
          const { userId } = msg.payload;
          setCursors((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
          break;
        }

        case SocketEvent.USER_LEFT: {
          const { userId } = msg.payload;
          setCursors((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
          setUserCount(msg.payload.count ?? 0);
          break;
        }

        case SocketEvent.USER_COUNT_UPDATED:
          setUserCount(msg.payload.count);
          break;

        // remove stroke from canvas by strokeId
        case SocketEvent.UNDO: {
          const canvas = document.querySelector("canvas") as any;
          if (canvas?.__removeStroke) canvas.__removeStroke(msg.payload.strokeId);
          break;
        }

        // draw stroke back on canvas
        case SocketEvent.REDO: {
          const canvas = document.querySelector("canvas") as any;
          if (canvas?.__drawStroke) canvas.__drawStroke(msg.payload.stroke);
          break;
        }

        case SocketEvent.ROOM_EXPIRED:
          setConnectionStatus("disconnected");
          ws.close();
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

  return {
    connectionStatus,
    userCount,
    cursors,
    sendStroke,
    sendCursorMove,
    leaveRoom,
    sendUndo,
    sendRedo,
  };
}