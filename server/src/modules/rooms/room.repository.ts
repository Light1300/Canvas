import {  RoomModel } from "./room.schema.js";

export const createRoom = async (
  roomId: string,
  expiresAt: Date
) => {
  return RoomModel.create({ roomId, expiresAt });
};

export const findRoomById = async(roomId: string )=>{
    return RoomModel.findOne({roomId}).lean();
}