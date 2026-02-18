import { randomUUID } from "crypto";
import * as repo from "./room.repository.js";
import { createRoom, findRoomById } from "./room.repository.js";

export const createRoomService = async () => {
  const roomId = randomUUID();

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await repo.createRoom(roomId, expiresAt);

  return { roomId, expiresAt };
};


export const validateRoomService = async (roomId: string) => {
  const room = await repo.findRoomById(roomId);
  return !!room;
};