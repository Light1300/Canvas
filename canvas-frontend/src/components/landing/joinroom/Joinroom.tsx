import { useState } from "react";
import { api } from "../../../lib/api";

export default function JoinRoom() {
  const [roomCode, setRoomCode] = useState("");

  const handleJoin = async () => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return alert("User not authenticated");

    if (!/^[a-zA-Z0-9]{4}$/.test(roomCode)) {
      return alert("Room code must be 4 alphanumeric characters");
    }

    try {
      const res = await api.post(
        "/room/join",
        { roomCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message || "Joined successfully");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to join room");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h2 className="text-2xl font-semibold mb-6">Join Room</h2>
      <input
        type="text"
        placeholder="Enter 4-digit Room Code"
        maxLength={4}
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
        className="border p-2 rounded mb-4 text-center w-48"
      />
      <button
        onClick={handleJoin}
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Join
      </button>
    </div>
  );
}