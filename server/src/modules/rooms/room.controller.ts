import { Request, Response } from "express";
import * as service from "./room.service.js";

export const createRoomController = async (_:Request, res:Response) =>{
    const data = await service.createRoomService();

    return res.status(201).json({
        success: true,
        data
    })
}


export const validateRoomController = async(req:Request, res: Response) =>{
    const { roomId }  = req.params;

    if(!roomId){
        return res.status(400).json({
            success:false,
            message:"Room ID is required",
        })
    }
    //@ts-ignore
    const isValid = await service.validateRoomService(roomId);
    
    if(!isValid){
        return res.status(404).json({
            success:false,
            message:"Room not Found",
        })
    }

    return res.status(200).json({
        success:true
    })
}