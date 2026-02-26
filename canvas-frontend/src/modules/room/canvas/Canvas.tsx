import { useRef, useEffect, useCallback } from "react";
import { Stroke } from "./canvas.types";

interface Props {
  roomId: string;
  sendStroke: (stroke: Stroke) => void;
}

export default function Canvas({ roomId, sendStroke }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const color = "#ffffff";
  const lineWidth = 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement!;
      const snapshot = ctxRef.current?.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      // willReadFrequently: true suppresses browser warning and optimises getImageData
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;
      if (snapshot) ctx.putImageData(snapshot, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    const pos = getPos(e);
    currentPoints.current = [pos];
    const ctx = ctxRef.current!;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const pos = getPos(e);
    currentPoints.current.push(pos);
    const ctx = ctxRef.current!;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [color, lineWidth]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (currentPoints.current.length > 1) {
      sendStroke({ roomId, points: currentPoints.current, color, width: lineWidth });
    }
    currentPoints.current = [];
    ctxRef.current?.beginPath();
  }, [roomId, sendStroke, color, lineWidth]);

  // Draw a single incoming stroke from another user (incremental)
  const drawExternalStroke = useCallback((stroke: Stroke) => {
    const ctx = ctxRef.current;
    if (!ctx || stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.beginPath();
  }, []);

  // Replace entire canvas with full history (INITIAL_STATE on join)
  const replaceStrokes = useCallback((strokes: Stroke[]) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    // Full reset — wipe everything
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Replay all strokes in order
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
      ctx.beginPath();
    }
  }, []);

  // Expose both methods on the canvas DOM element
  // useRoomSocket calls these directly without React coupling
  useEffect(() => {
    const canvas = canvasRef.current as any;
    if (canvas) {
      canvas.__drawStroke = drawExternalStroke;
      canvas.__replaceStrokes = replaceStrokes;
    }
  }, [drawExternalStroke, replaceStrokes]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 cursor-crosshair touch-none"
      style={{ background: "#0f0f11" }}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    />
  );
}