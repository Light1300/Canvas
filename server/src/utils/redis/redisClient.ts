import { createClient } from "redis";

// One client for get/set (OTP etc), one for publish, one for subscribe
// All using the same node-redis library — no mixing with ioredis
const redis = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    reconnectStrategy: (retries) => Math.min(retries * 100, 2000),
  }
});

export const redisPublisher = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  }
});

export const redisSubscriber = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  }
});

redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err: Error) => console.error("Redis error:", err.message));
redisPublisher.on("error", (err: Error) => console.error("Redis publisher error:", err.message));
redisSubscriber.on("error", (err: Error) => console.error("Redis subscriber error:", err.message));

// Connect all three
Promise.all([
  redis.connect(),
  redisPublisher.connect(),
  redisSubscriber.connect(),
]).then(() => {
  console.log("All Redis clients connected");
}).catch((err) => {
  console.error("Redis connection failed:", err);
  process.exit(1);
});

export default redis;