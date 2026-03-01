import { Router } from "express";
import { createRoomController, validateRoomController } from "../modules/rooms/room.controller.js";
import { verifyAccessToken } from "../utils/auth/jwt.js";
import { createRoomLimiter } from "../middleware/rate-limit.js";
import { logoutHandler } from "../api/landing-page/refresh.js";

const authenticatedRouter = Router();

authenticatedRouter.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const parts = authHeader.split(" ");
  const [, token] = parts;
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  try {
    // @ts-ignore
    const decoded = verifyAccessToken(token);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
});

/**
 * @swagger
 * tags:
 *   name: Rooms
 *   description: Room creation and validation
 */

/**
 * @swagger
 * /api/user/rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Room'
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Too many rooms created
 */
authenticatedRouter.post("/rooms", createRoomLimiter, createRoomController);

/**
 * @swagger
 * /api/user/rooms/{roomId}:
 *   get:
 *     summary: Validate a room exists and has not expired
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         example: c90258ab-65eb-4473-8c3c-9338174c2639
 *     responses:
 *       200:
 *         description: Room is valid
 *       404:
 *         description: Room not found or expired
 *       401:
 *         description: Unauthorized
 */
authenticatedRouter.get("/rooms/:roomId", validateRoomController);

/**
 * @swagger
 * /api/user/me:
 *   get:
 *     summary: Get current authenticated user from JWT
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns decoded user from token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
authenticatedRouter.get("/me", (req, res) => {
  res.status(200).json({ success: true, user: (req as any).user });
});

authenticatedRouter.post("/logout", logoutHandler);

export default authenticatedRouter;