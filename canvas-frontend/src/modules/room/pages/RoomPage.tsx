import { useParams  } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useRoomSocket } from "../../../hooks/useRoomSocket";

import { useState } from "react";

import Canvas from "../canvas/Canvas";

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { connectionStatus, userCount, sendStroke } = useRoomSocket(roomId!);

  const handleCopyRoom = () => {
    navigator.clipboard.writeText(roomId!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${statusColor[connectionStatus] ?? "bg-white/20"} ${connectionStatus === "connecting" ? "animate-pulse" : ""}`} />
            <span className="text-xs text-white/30 capitalize">{connectionStatus}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/8">
            <span className="text-xs text-white/40">{userCount} online</span>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            Leave
          </button>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <Canvas roomId={roomId!} sendStroke={sendStroke} />
      </div>
    </div>
  );
}