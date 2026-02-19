import { Server as HTTPServer } from "http"
import { WebSocketServer } from "ws"
import { setupHeartbeat } from "./ws.heartbeat.js"

export const initWebSocketServer = (server: HTTPServer) => {
  const wss = new WebSocketServer({ server })

  setupHeartbeat(wss)

  return wss
}