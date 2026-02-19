import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";

export default function CreateRoom() {
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  const handleCreate = async () => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return alert("User not authenticated");

    if (!/^[a-zA-Z0-9]{4}$/.test(roomCode)) {
      return alert("Room code must be 4 alphanumeric characters");
    }

    try {
      await api.post(
        "/room/create",
        { roomCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      navigate(`/room/${roomCode}`);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create room");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h2 className="text-2xl font-semibold mb-6">Create Room</h2>
      <input
        maxLength={4}
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
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