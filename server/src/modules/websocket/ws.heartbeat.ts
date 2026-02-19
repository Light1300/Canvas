import { Server } from "ws"
import { ExtendedWebSocket } from "./ws.types.js"

export const setupHeartbeat = (wss: Server) => {
  wss.on("connection", (ws) => {
    const socket = ws as ExtendedWebSocket
    socket.isAlive = true

    socket.on("pong", () => {
      socket.isAlive = true
    })
  })

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socket = ws as unknown as ExtendedWebSocket

      if (!socket.isAlive) {
        socket.terminate()
        return
      }

      socket.isAlive = false
      socket.ping()
    })
  }, 30000)

  wss.on("close", () => {
    clearInterval(interval)
  })
}