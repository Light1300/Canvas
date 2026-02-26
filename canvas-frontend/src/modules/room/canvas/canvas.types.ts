export interface Stroke {
  roomId: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  strokeId: string;  // unique per stroke
  userId: string;    // who drew it 
}
export interface CanvasProps {
  roomId: string;
  sendStroke: (stroke: Stroke) => void;
}