import { useState } from "react";

export default function CreateRoom() {
  const [roomCode, setRoomCode] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);

  const handleCreate = () => {
    if (!/^[a-zA-Z0-9]{4}$/.test(roomCode)) {
      return alert("Room code must be 4 alphanumeric characters");
    }

    const token = sessionStorage.getItem("accessToken");
    if (!token) return alert("User not authenticated");

    const socket = new WebSocket(`ws://localhost:8080/ws?roomCode=${roomCode}&token=${token}`);
    
    socket.onopen = () => {
      alert(`Room ${roomCode} created and connected`);
    };

    socket.onmessage = (msg) => {
      console.log("Message from server:", msg.data);
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      alert("Failed to connect WebSocket");
    };

    setWs(socket);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h2 className="text-2xl font-semibold mb-6">Create Room</h2>
      <input
        type="text"
        placeholder="Enter 4-digit Room Code"
        maxLength={4}
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
        className="border p-2 rounded mb-4 text-center w-48"
      />
      <button
        onClick={handleCreate}
        className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Create Room
      </button>
    </div>
  );
}