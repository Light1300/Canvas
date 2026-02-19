import { useEffect, useRef, useState } from "react";
import { WebSocketService } from "../services/websocket.service";
import { env } from "../shared/config/env";
import { ServerEvent, ClientEvent } from "../modules/room/types/socket.types";
import { useRoomStore } from "../modules/room/store/room.store";

export const useRoomSocket = (roomId: string) => {
  const wsRef = useRef<WebSocketService<ServerEvent> | null>(null);
  const [userCount, setUserCount] = useState<number>(0);

  useEffect(() => {
    const ws = new WebSocketService<ServerEvent>(env.wsUrl);
    wsRef.current = ws;
    
    useRoomStore.getState().setConnectionStatus("connecting");

       ws.connect({
      onOpen: () => {
        useRoomStore.getState().setConnectionStatus("connected");

        ws.send({
          type: "JOIN_ROOM",
          payload: { roomId },
        });
      },

      onMessage: (message) => {
      switch (message.type) {
        case "USER_COUNT_UPDATED":
          useRoomStore.getState().setUserCount(
            message.payload.count
          );
          break;
      }
    },

    onClose: () => {
      useRoomStore.getState().setConnectionStatus("disconnected");
    },

    onError: () => {
      useRoomStore.getState().setConnectionStatus("error");
    },
  });

  return () => {
    ws.send({
      type: "LEAVE_ROOM",
      payload: { roomId },
    });

    ws.disconnect();
  };
}, [roomId]);

  const send = (event: ClientEvent) => {
    wsRef.current?.send(event);
  };

  return { userCount, send };
};