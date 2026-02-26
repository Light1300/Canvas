import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";

const rateLimitRedis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

rateLimitRedis.on("error", (err) => {
  console.error("[RateLimit] Redis error:", err);
});

rateLimitRedis.connect().then(() => {
  console.log("[RateLimit] Redis connected");
});

const makeStore = (prefix: string) =>
  new RedisStore({
    sendCommand: (...args: string[]) =>
      rateLimitRedis.sendCommand(args) as any,
    prefix,
  });

// Auth
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  
  max: 10,                    
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:auth:"),
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

// Room creation 
export const createRoomLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  
  max: 20,                    
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:room:"),
  message: {
    success: false,
    message: "Too many rooms created. Please try again later.",
  },
});

// Refresh token 
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  
  max: 30,                    
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:refresh:"),
  message: {
    success: false,
    message: "Too many token refresh attempts. Please try again later.",
  },
});