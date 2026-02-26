import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Canvas from "../../modules/room/canvas/Canvas";
import GhostCursors from "../../components/GhostCursor";
import { useRoomSocket } from "../../hooks/useRoomSocket";

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Pull userId from the stored JWT payload
  const rawUser = localStorage.getItem("user");
  const userId = rawUser ? JSON.parse(rawUser)?.userId ?? "" : "";

  const {
    connectionStatus,
    userCount,
    cursors,
    sendStroke,
    sendCursorMove,
    leaveRoom,
    sendUndo,
    sendRedo,
  } = useRoomSocket(roomId!);

  const handleCopyRoom = () => {
    navigator.clipboard.writeText(roomId!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    leaveRoom();
    navigate("/dashboard");
  };

  const statusColor: Record<string, string> = {
    idle: "bg-white/20",
    connecting: "bg-yellow-400",
    connected: "bg-emerald-400",
    disconnected: "bg-red-400",
  };

  return (
    <div className="h-screen flex flex-col bg-[#0f0f11] overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-white text-sm">Canva</span>
          <div className="w-px h-4 bg-white/10" />
          <button
            onClick={handleCopyRoom}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/8 transition-colors"
          >
            <span className="text-xs text-white/40 font-mono">{roomId?.slice(0, 8)}...</span>
            <span className="text-xs text-white/25">{copied ? "✓ copied" : "copy"}</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Undo / Redo buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const canvas = document.querySelector("canvas") as any;
                if (canvas?.__triggerUndo) canvas.__triggerUndo();
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              ↩
            </button>
            <button
              onClick={() => {
                const canvas = document.querySelector("canvas") as any;
                if (canvas?.__triggerRedo) canvas.__triggerRedo();
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
              title="Redo (Ctrl+Y)"
            >
              ↪
            </button>
          </div>

          <div className="w-px h-4 bg-white/10" />

          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${statusColor[connectionStatus] ?? "bg-white/20"} ${connectionStatus === "connecting" ? "animate-pulse" : ""}`} />
            <span className="text-xs text-white/30 capitalize">{connectionStatus}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/8">
            <span className="text-xs text-white/40">{userCount} online</span>
          </div>
          <button
            onClick={handleLeave}
            className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Canvas area — position relative so cursors are positioned inside it */}
      <div className="flex-1 relative overflow-hidden">
        <Canvas
          roomId={roomId!}
          userId={userId}
          sendStroke={sendStroke}
          sendCursorMove={sendCursorMove}
          sendUndo={sendUndo}
          sendRedo={sendRedo}
        />
        {/* Ghost cursors overlay — sits on top of canvas, pointer-events-none */}
        <GhostCursors cursors={cursors} currentUserId={userId} />
      </div>
    </div>
  );
}