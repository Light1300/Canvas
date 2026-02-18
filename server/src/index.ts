import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";

import { connectDB } from "./utils/mongodb/mongo-client.js";
import generalRouter from "./routes/general-routes.js";
import authenticatedRouter from "./routes/authenticated-routes.js";
import { initWebSocketServer } from "./websocket/socket.server.js";
import { connectMongo } from "./modules/rooms/room.schema.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true
  })
);

app.use(express.json());

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
  } catch (error) {
    console.error("Startup failed:", error);
    process.exit(1);
  }
};

startServer();