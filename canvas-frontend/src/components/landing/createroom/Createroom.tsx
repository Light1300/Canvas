import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";

export default function CreateRoom() {
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  const handleCreate = async () => {
    console.log("[CreateRoom] Create button clicked");

    const token = sessionStorage.getItem("accessToken");
    console.log("[CreateRoom] Retrieved token:", token ? "FOUND" : "MISSING");

    if (!token) {
      console.error("[CreateRoom] User not authenticated");
      return alert("User not authenticated");
    }

    console.log("[CreateRoom] Room code entered:", roomCode);

    if (!/^[a-zA-Z0-9]{4}$/.test(roomCode)) {
      console.error("[CreateRoom] Invalid room code format");
      return alert("Room code must be 4 alphanumeric characters");
    }

    try {
      console.log("[CreateRoom] Sending create request...");

      const res = await api.post(
        "/room/create",
        { roomCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("[CreateRoom] Room created successfully:", res?.data);

      console.log("[CreateRoom] Navigating to room:", `/room/${roomCode}`);
      navigate(`/room/${roomCode}`);
    } catch (err: any) {
      console.error("[CreateRoom] Create failed");

      if (err.response) {
        console.error("[CreateRoom] Server response error:", {
          status: err.response.status,
          data: err.response.data,
        });
      } else if (err.request) {
        console.error("[CreateRoom] No response received:", err.request);
      } else {
        console.error("[CreateRoom] Unexpected error:", err.message);
      }

      alert(err.response?.data?.message || "Failed to create room");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h2 className="text-2xl font-semibold mb-6">Create Room</h2>
      <input
        maxLength={4}
        value={roomCode}
        onChange={(e) => {
          console.log("[CreateRoom] Room code changed:", e.target.value);
          setRoomCode(e.target.value);
        }}
        className="border p-2 rounded mb-4 text-center w-48"
      />
      <button
        onClick={handleCreate}
        className="px-6 py-2 bg-green-600 text-white rounded"
      >
        Create Room
      </button>
    </div>
  );
}