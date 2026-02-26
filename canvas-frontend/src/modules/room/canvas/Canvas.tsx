import { useRef, useEffect, useCallback } from "react";
import { Stroke } from "./canvas.types";

interface Props {
  roomId: string;
  userId: string;
  sendStroke: (stroke: Stroke) => void;
  sendCursorMove: (x: number, y: number) => void;
  sendUndo: (strokeId: string) => void;
  sendRedo: (stroke: Stroke) => void;
}

export default function Canvas({ roomId, userId, sendStroke, sendCursorMove, sendUndo, sendRedo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const undoStack = useRef<Stroke[]>([]);
  const redoStack = useRef<Stroke[]>([]);
  const allStrokes = useRef<Stroke[]>([]);

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

  const drawSingleStroke = useCallback((stroke: Stroke) => {
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

  const replayCanvas = useCallback((strokes: Stroke[]) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) drawSingleStroke(stroke);
  }, [drawSingleStroke]);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const stroke = undoStack.current.pop()!;
    redoStack.current.push(stroke);
    allStrokes.current = allStrokes.current.filter((s) => s.strokeId !== stroke.strokeId);
    replayCanvas(allStrokes.current);
    sendUndo(stroke.strokeId);
  }, [sendUndo, replayCanvas]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const stroke = redoStack.current.pop()!;
    undoStack.current.push(stroke);
    allStrokes.current.push(stroke);
    drawSingleStroke(stroke);
    sendRedo(stroke);
  }, [sendRedo, drawSingleStroke]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && e.key === "z") { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleUndo, handleRedo]);

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
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    sendCursorMove(e.clientX - rect.left, e.clientY - rect.top);
    draw(e);
  }, [draw, sendCursorMove]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (currentPoints.current.length > 1) {
      const stroke: Stroke = {
        roomId,
        points: currentPoints.current,
        color,
        width: lineWidth,
        strokeId: crypto.randomUUID(),
        userId,
      };
      allStrokes.current.push(stroke);
      undoStack.current.push(stroke);
      redoStack.current = [];
      sendStroke(stroke);
    }
    currentPoints.current = [];
    ctxRef.current?.beginPath();
  }, [roomId, userId, sendStroke]);

  // Incoming stroke from another user
  const drawExternalStroke = useCallback((stroke: Stroke) => {
    allStrokes.current.push(stroke);
    drawSingleStroke(stroke);
  }, [drawSingleStroke]);

  // Full history on join
  const replaceStrokes = useCallback((strokes: Stroke[]) => {
    allStrokes.current = [...strokes];
    replayCanvas(strokes);
  }, [replayCanvas]);

  const removeStroke = useCallback((strokeId: string) => {
    allStrokes.current = allStrokes.current.filter((s) => s.strokeId !== strokeId);
    replayCanvas(allStrokes.current);
  }, [replayCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current as any;
    if (!canvas) return;
    canvas.__drawStroke = drawExternalStroke;
    canvas.__replaceStrokes = replaceStrokes;
    canvas.__removeStroke = removeStroke;
    canvas.__triggerUndo = handleUndo;
    canvas.__triggerRedo = handleRedo;
  }, [drawExternalStroke, replaceStrokes, removeStroke, handleUndo, handleRedo]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 cursor-crosshair touch-none"
      style={{ background: "#0f0f11" }}
      onMouseDown={startDrawing}
      onMouseMove={handleMouseMove}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    />
  );
}