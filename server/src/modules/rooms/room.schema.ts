import mongoose from "mongoose";
import { Schema, model } from "mongoose";
import { Room } from "./room.types.js";

const roomSchema = new Schema<Room>({
  roomId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Mongo TTL
  }
});

export const connectMongo = async() =>{
  await mongoose.connect(process.env.MONGO_URI!);
  console.log("MongoDB connected");
}

export const RoomModel = model<Room>("Room", roomSchema);