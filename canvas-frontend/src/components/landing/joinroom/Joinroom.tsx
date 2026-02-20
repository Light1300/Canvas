import { useState } from "react";
import { api } from "../../../lib/api";

export default function JoinRoom() {
  const [roomCode, setRoomCode] = useState("");

  const handleJoin = async () => {
    console.log("[JoinRoom] Join button clicked");

    const token = sessionStorage.getItem("accessToken");
    console.log("[JoinRoom] Retrieved token:", token ? "FOUND" : "MISSING");

    if (!token) {
      console.error("[JoinRoom] User not authenticated");
      return alert("User not authenticated");
    }

    console.log("[JoinRoom] Room code entered:", roomCode);

    if (!/^[a-zA-Z0-9]{4}$/.test(roomCode)) {
      console.error("[JoinRoom] Invalid room code format");
      return alert("Room code must be 4 alphanumeric characters");
    }

    try {
      console.log("[JoinRoom] Sending join request...");

      const res = await api.post(
        "/room/join",
        { roomCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("[JoinRoom] Join successful:", res.data);

      alert(res.data.message || "Joined successfully");
    } catch (err: any) {
      console.error("[JoinRoom] Join failed");

      if (err.response) {
        console.error("[JoinRoom] Server response error:", {
          status: err.response.status,
          data: err.response.data,
        });
      } else if (err.request) {
        console.error("[JoinRoom] No response received:", err.request);
      } else {
        console.error("[JoinRoom] Unexpected error:", err.message);
      }

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
        onChange={(e) => {
          console.log("[JoinRoom] Room code changed:", e.target.value);
          setRoomCode(e.target.value);
        }}
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