import { randomUUID } from "crypto";
import * as repo from "./room.repository.js";

export const createRoomService = async () =>{
    const roomId = randomUUID();
    await repo.createRoom(roomId);
    return { roomId };
}


export const validateRoomService = async (roomId: string) => {
  const room = await repo.findRoomById(roomId);
  return !!room;
};