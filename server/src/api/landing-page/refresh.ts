import { Request, Response } from "express";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../utils/auth/jwt.js";
import { rotateRefreshToken, revokeRefreshToken } from "../../services/refresh-token-service.js";

export const refreshTokenHandler = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: "Refresh token required.",
    });
  }

  let decoded: { userId: string };

  try {
    decoded = verifyRefreshToken(refreshToken) as { userId: string };
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token.",
    });
  }

  const { userId } = decoded;

  const newRefreshToken = generateRefreshToken(userId);

  //invalidate old token, store new one
  const rotated = await rotateRefreshToken(refreshToken, newRefreshToken, userId);

  if (!rotated) {
    return res.status(401).json({
      success: false,
      message: "Refresh token has already been used or expired. Please sign in again.",
    });
  }

  const newAccessToken = generateAccessToken(userId, "", "");

  return res.status(200).json({
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
};

export const logoutHandler = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};