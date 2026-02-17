export interface SocketMessage<T = unknown>{
    type:string;
    payload: T;
}

export interface JoinRoomPayload{
    roomId:string;
}

export interface CanvasUpdatePayload {
    roomId: string;
    canvasData: unknown;
}