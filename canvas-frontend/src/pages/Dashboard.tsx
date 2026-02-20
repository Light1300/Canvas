import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [roomInput, setRoomInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const handleCreateRoom = async () => {
    try {
      setCreating(true);
      setError("");
      const res = await api.post("/user/rooms");
      const { roomId } = res.data.data;
      navigate(`/room/${roomId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create room.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    const trimmed = roomInput.trim();
    if (!trimmed) return;

    try {
      setJoining(true);
      setError("");
      const res = await api.get(`/user/rooms/${trimmed}`);
      if (res.data.success) {
        navigate(`/room/${trimmed}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Room not found.");
    } finally {
      setJoining(false);
    }
  };

  const handleSignout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    navigate("/signin");
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] text-white font-['DM_Sans',sans-serif]">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 12L5 7L8 10L11 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-semibold text-white tracking-tight">Canva</span>
        </div>
        <button
          onClick={handleSignout}
          className="text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-6 pt-24 pb-16">
        <div className="mb-16">
          <p className="text-white/30 text-sm font-mono uppercase tracking-widest mb-3">Real-time whiteboard</p>
          <h1 className="text-5xl font-bold tracking-tight leading-tight">
            Start drawing<br />
            <span className="text-white/25">together.</span>
          </h1>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          {/* Create Room */}
          <div className="group relative rounded-2xl border border-white/8 bg-white/3 hover:bg-white/5 hover:border-white/15 transition-all duration-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-white mb-1">New Room</h2>
                <p className="text-sm text-white/35">Create a fresh canvas and invite others with a link.</p>
              </div>
              <button
                onClick={handleCreateRoom}
                disabled={creating}
                className="shrink-0 ml-4 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>

          {/* Join Room */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
            <h2 className="font-semibold text-white mb-1">Join Room</h2>
            <p className="text-sm text-white/35 mb-4">Enter a room code to collaborate on an existing canvas.</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                placeholder="Paste room code..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
              />
              <button
                onClick={handleJoinRoom}
                disabled={joining || !roomInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors border border-white/10"
              >
                {joining ? "Joining..." : "Join"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <p className="mt-12 text-center text-white/20 text-xs">
          Rooms expire after 24 hours
        </p>
      </main>
    </div>
  );
}