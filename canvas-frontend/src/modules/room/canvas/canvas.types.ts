export interface Stroke {
  roomId: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface CanvasProps {
  roomId: string;
  sendStroke: (stroke: Stroke) => void;
}