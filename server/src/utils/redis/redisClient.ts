import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redis = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 2000),
  }
});

export const redisPublisher = createClient({ url: redisUrl });
export const redisSubscriber = createClient({ url: redisUrl });

redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err: Error) => console.error("Redis error:", err.message));
redisPublisher.on("error", (err: Error) => console.error("Redis publisher error:", err.message));
redisSubscriber.on("error", (err: Error) => console.error("Redis subscriber error:", err.message));

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