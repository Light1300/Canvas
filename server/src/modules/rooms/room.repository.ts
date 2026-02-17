import {  RoomModel } from "./room.schema.js";

export const createRoom = async(roomId: string) =>{
    return RoomModel.create({ roomId });
}

export const findRoomById = async(roomId: string )=>{
    return RoomModel.findOne({roomId}).lean();
}