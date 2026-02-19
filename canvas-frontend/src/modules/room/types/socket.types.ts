export type ServerEvent =
  | { type: "USER_COUNT_UPDATED"; payload: { count: number } }
  | { type: "CANVAS_UPDATE"; payload: { data: unknown } };

export type ClientEvent =
  | { type: "JOIN_ROOM"; payload: { roomId: string } }
  | { type: "LEAVE_ROOM"; payload: { roomId: string } }
  | { type: "UPDATE_CANVAS"; payload: unknown };