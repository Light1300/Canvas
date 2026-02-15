import { Redis } from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number {
    return Math.min(times * 100, 2000);
  }
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (err: Error) => {
  console.error("Redis error:", err.message);
});

export default redis;