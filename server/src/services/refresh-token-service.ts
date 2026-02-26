import { redisPublisher } from "../utils/redis/redisClient.js";
import crypto from "crypto";

const tokenKey = (hashed: string) => `refresh:${hashed}`;

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; 

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

// Store a new refresh token in Redis
export const storeRefreshToken = async (
  userId: string,
  token: string
): Promise<void> => {
  const hashed = hashToken(token);
  await redisPublisher.setEx(
    tokenKey(hashed),
    REFRESH_TTL_SECONDS,
    userId
  );
};

// Validate token exists and belongs to expected user
export const validateRefreshToken = async (
  token: string
): Promise<string | null> => {
  const hashed = hashToken(token);
  const userId = await redisPublisher.get(tokenKey(hashed));
  return userId;
};

// Delete a specific token after logout
export const revokeRefreshToken = async (token: string): Promise<void> => {
  const hashed = hashToken(token);
  await redisPublisher.del(tokenKey(hashed));
};

// Rotate: invalidate old token, store new one atomically
export const rotateRefreshToken = async (
  oldToken: string,
  newToken: string,
  userId: string
): Promise<boolean> => {
  const oldHashed = hashToken(oldToken);
  const existing = await redisPublisher.get(tokenKey(oldHashed));

  if (!existing) {
    // Token not in Redis 
    console.warn(`[Security] Refresh token reuse detected for user ${userId}`);
    return false;
  }

  if (existing !== userId) {
    // to prevent copy 
    console.warn(`[Security] Token userId mismatch — stored: ${existing}, claimed: ${userId}`);
    return false;
  }

  // Invalidate old 
  await redisPublisher.del(tokenKey(oldHashed));
  await storeRefreshToken(userId, newToken);

  return true;
};