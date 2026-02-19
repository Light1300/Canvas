// src/shared/config/env.ts

const wsUrl = process.env.VITE_WS_URL;
const apiUrl = process.env.VITE_API_URL;

if (!wsUrl) {
  throw new Error("VITE_WS_URL is not defined");
}

if (!apiUrl) {
  throw new Error("VITE_API_URL is not defined");
}

export const env = {
  wsUrl,
  apiUrl,
};