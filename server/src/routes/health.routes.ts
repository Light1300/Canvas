import { Router, Request, Response } from "express";
import { createClient } from "redis";
import mongoose from "mongoose";

const healthRouter = Router();

let redisCheckClient: ReturnType<typeof createClient> | null = null;

const getRedisClient = async () => {
  if (!redisCheckClient) {
    redisCheckClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });
    redisCheckClient.on("error", () => {});
    await redisCheckClient.connect();
  }
  return redisCheckClient;
};

// GET /health
// Used by: Railway, AWS ALB, ECS, Kubernetes, Docker HEALTHCHECK
// Must always be public — no auth middleware
healthRouter.get("/health", async (_req: Request, res: Response) => {
  const start = Date.now();

  let redisStatus = "disconnected";
  try {
    const client = await getRedisClient();
    const pong = await client.ping();
    redisStatus = pong === "PONG" ? "connected" : "degraded";
  } catch {
    redisStatus = "disconnected";
  }

  const mongoStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";

  const healthy = redisStatus === "connected" && mongoStatus === "connected";

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    uptime: Math.floor(process.uptime()),
    responseTime: `${Date.now() - start}ms`,
    timestamp: new Date().toISOString(),
    dependencies: {
      redis: redisStatus,
      mongodb: mongoStatus,
    },
  });
});

// GET /ready
// Kubernetes readiness probe / AWS ECS target group health check
// "Is this instance ready to serve traffic?"
healthRouter.get("/ready", (_req: Request, res: Response) => {
  const mongoReady = mongoose.connection.readyState === 1;

  if (!mongoReady) {
    res.status(503).json({ status: "not ready", reason: "mongodb not connected" });
    return;
  }

  res.status(200).json({ status: "ready" });
});

export default healthRouter;