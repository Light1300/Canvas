import { Router } from "express";
import { createRoomController, validateRoomController } from "../modules/rooms/room.controller.js";
import { verifyAccessToken } from "../utils/auth/jwt.js";

const authenticatedRouter = Router();

// ── Auth middleware ──────────────────────────────────────────────────────────
authenticatedRouter.use((req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  const parts = authHeader.split(" ");
  const [, token] = parts;

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
  }

  try {
    // @ts-ignore
    const decoded = verifyAccessToken(token);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
});

// ── Routes ───────────────────────────────────────────────────────────────────
authenticatedRouter.post("/rooms", createRoomController);
authenticatedRouter.get("/rooms/:roomId", validateRoomController);

authenticatedRouter.get("/me", (req, res) => {
  res.status(200).json({
    success: true,
    user: (req as any).user
  });
});

authenticatedRouter.post("/logout", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
});

export default authenticatedRouter;