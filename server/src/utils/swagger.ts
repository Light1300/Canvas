import swaggerJsdoc from "swagger-jsdoc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Canvas API",
      version: "1.0.0",
      description: "Real-time collaborative whiteboard API",
    },
    servers: [
      {
        url: "http://localhost:8080",
        description: "Local",
      },
      {
        url: process.env.RAILWAY_PUBLIC_DOMAIN
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
          : "https://your-app.railway.app",
        description: "Production",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Access token from /api/home/signin",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Something went wrong" },
          },
        },
        User: {
          type: "object",
          properties: {
            userId: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
            name: { type: "string", example: "Sarvesh Patil" },
            email: { type: "string", example: "sarvesh@example.com" },
          },
        },
        Tokens: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            user: { $ref: "#/components/schemas/User" },
          },
        },
        Room: {
          type: "object",
          properties: {
            roomId: { type: "string", example: "c90258ab-65eb-4473-8c3c-9338174c2639" },
            expiresAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },
  // Point to SOURCE .ts files — swagger-jsdoc reads comments, not executes code
  // Use absolute paths resolved from this file's location
  apis: [
    path.join(__dirname, "../routes/*.js"),
    path.join(__dirname, "../api/**/*.js"),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);