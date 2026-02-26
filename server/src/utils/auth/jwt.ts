import jwt from "jsonwebtoken";
import crypto from "crypto";

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("JWT secrets not defined");
}

export const generateAccessToken = (userId: string, email: string, name: string) => {
  return jwt.sign(
    { userId, email, name, isVerified: true },
    ACCESS_SECRET,
    { expiresIn: "15m" }
  );
};

export const generateRefreshToken = (userId: string) => {
  return jwt.sign(
    { userId },
    REFRESH_SECRET,
    { expiresIn: "30d" }
  );
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, ACCESS_SECRET) as {
    userId: string;
    email: string;
    name: string;
    isVerified: boolean;
  };
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, REFRESH_SECRET) as { userId: string };
};

export const hashToken = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};