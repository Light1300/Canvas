import express from "express";
import { signup, signin, verifyOtp } from "../api/landing-page/signin-signup.js";
import { refreshTokenHandler, logoutHandler } from "../api/landing-page/refresh.js";
import { authLimiter, refreshLimiter } from "../middleware/rate-limit.js";

const generalRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and account management
 */

/**
 * @swagger
 * /api/home/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Sarvesh Patil
 *               email:
 *                 type: string
 *                 example: sarvesh@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       201:
 *         description: OTP sent to email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 verificationToken:
 *                   type: string
 *       409:
 *         description: User already exists
 *       429:
 *         description: Too many attempts
 *       500:
 *         $ref: '#/components/schemas/Error'
 */
generalRouter.post("/signup", authLimiter, async (req, res) => {
  const response = await signup({ body: JSON.stringify(req.body) });
  res.status(response.statusCode).json(JSON.parse(response.body));
});

/**
 * @swagger
 * /api/home/verify-otp:
 *   post:
 *     summary: Verify OTP and activate account
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     description: Send the verificationToken from /signup as Bearer token in Authorization header
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp:
 *                 type: string
 *                 example: "482910"
 *     responses:
 *       200:
 *         description: Account verified, returns tokens
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tokens'
 *       400:
 *         description: Invalid or expired OTP
 *       401:
 *         description: Verification token missing
 */
generalRouter.post("/verify-otp", async (req, res) => {
  const response = await verifyOtp({
    body: JSON.stringify(req.body),
    headers: req.headers,
  });
  res.status(response.statusCode).json(JSON.parse(response.body));
});

/**
 * @swagger
 * /api/home/signin:
 *   post:
 *     summary: Sign in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: sarvesh@example.com
 *               password:
 *                 type: string
 *                 example: secret123
 *     responses:
 *       200:
 *         description: Returns access token, refresh token, and user object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tokens'
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
 *       429:
 *         description: Too many attempts
 */
generalRouter.post("/signin", authLimiter, async (req, res) => {
  const response = await signin({ body: JSON.stringify(req.body) });
  res.status(response.statusCode).json(JSON.parse(response.body));
});

/**
 * @swagger
 * /api/home/refresh-token:
 *   post:
 *     summary: Rotate refresh token and get new access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Returns new access and refresh tokens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Invalid, expired, or already-used refresh token (reuse attack)
 *       429:
 *         description: Too many refresh attempts
 */
generalRouter.post("/refresh-token", refreshLimiter, refreshTokenHandler);

/**
 * @swagger
 * /api/home/logout:
 *   post:
 *     summary: Revoke refresh token and sign out
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
generalRouter.post("/logout", logoutHandler);

export default generalRouter;