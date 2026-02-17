import { Schema , model } from "mongoose";
import { Room } from "./room.types.js";

const roomSchema = new Schema<Room>({
    roomId: { type: String, required: true, unique:true },
    createdAt: { type:Date, default: Date.now  }
});

export const RoomModel = model<Room>("Room", roomSchema);