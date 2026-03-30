  import express from "express";
  import cors from "cors";
  import dotenv from "dotenv";
  import http from "http";
  import swaggerUi from "swagger-ui-express";
  import { requestLogger } from "./middleware/requestId.js";
  import { logger } from "./utils/logger/logger.js";

  import { connectDB } from "./utils/mongodb/mongo-client.js";
  import generalRouter from "./routes/general-routes.js";
  import authenticatedRouter from "./routes/authenticated-routes.js";
  import healthRouter from "./routes/health.routes.js";
  import { initWebSocketServer } from "./websocket/socket.server.js";
  import { connectMongo } from "./modules/rooms/room.schema.js";
  import { swaggerSpec } from "./utils/swagger.js";

  dotenv.config();

  const app = express();
  const PORT = process.env.PORT || 8080;
  app.set("trust proxy", 1);
  
  app.use(
    cors({
      origin: process.env.CLIENT_URL,
      credentials: true,
    })
  );
  
  app.use(express.json());
  app.use(requestLogger);

  // ── Public routes ────────────────────────────────────────────────────────────
  app.use("/", healthRouter);

  // Swagger UI — available at /api-docs
  // Disabled in production if you want to keep it internal
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "Canvas API Docs",
      swaggerOptions: {
        persistAuthorization: true,   // keeps JWT filled in after page refresh
        displayRequestDuration: true, // shows how long each request took
      },
    })
  );

  // Raw spec as JSON — useful for importing into Postman or Insomnia
  app.get("/api-docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  app.use("/api/home", generalRouter);
  app.use("/api/user", authenticatedRouter);

  const startServer = async () => {
    try {
      await connectDB();
      await connectMongo();

      const server = http.createServer(app);

      initWebSocketServer(server);

      server.listen(PORT, () => {
        logger.info({ port: PORT }, "Server started");
        logger.info({ url: `/api-docs` }, "Swagger available");
      });

      const shutdown = (signal: string) => {
        console.log(`[Shutdown] ${signal} received — closing gracefully`);
        server.close(() => {
        logger.info("HTTP server closed");
          process.exit(0);
        });
        setTimeout(() => {
          logger.error("Forced shutdown after timeout");
          process.exit(1);
        }, 10000);
      };

      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));

    } catch (error) {
      logger.error({ err: error }, "Startup failed");
      process.exit(1);
    }
  };

  startServer();