import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";

import { connectDB } from "./utils/mongodb/mongo-client.js";
import generalRouter from "./routes/general-routes.js";
import authenticatedRouter from "./routes/authenticated-routes.js";
import healthRouter from "./routes/health.routes.js";  
import { initWebSocketServer } from "./websocket/socket.server.js";
import { connectMongo } from "./modules/rooms/room.schema.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

app.use("/", healthRouter);                 // ← new: GET /health  GET /ready
app.use("/api/home", generalRouter);
app.use("/api/user", authenticatedRouter);

const startServer = async () => {
  try {
    await connectDB();
    await connectMongo();

    const server = http.createServer(app);

    initWebSocketServer(server);

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // ── Graceful shutdown ──────────────────────────────────────────────────
    // Railway sends SIGTERM before container swap
    // AWS ECS sends SIGTERM before deregistering from load balancer
    const shutdown = (signal: string) => {
      console.log(`[Shutdown] ${signal} received — closing gracefully`);
      server.close(() => {
        console.log("[Shutdown] HTTP server closed");
        process.exit(0);
      });
      // Force exit after 10s if connections don't drain
      setTimeout(() => {
        console.error("[Shutdown] Forced exit after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
};

startServer();