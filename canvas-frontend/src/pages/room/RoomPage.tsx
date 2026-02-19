import { useParams } from "react-router-dom";
import { useRoomSocket } from "../../hooks/useRoomSocket";
import { useRoomStore } from "../../modules/room/store/room.store";

export default function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();

  // Start socket lifecycle
  const { send } = useRoomSocket(roomCode ?? "");

  // Subscribe to store state
  const userCount = useRoomStore((state) => state.userCount);

  const connectionStatus = useRoomStore(
  (state) => state.connectionStatus
  );

  const handleTestMessage = () => {
    send({
      type: "UPDATE_CANVAS",
      payload: { test: "hello" },
    });
  };

  if (!roomCode) {
    return <div>Invalid room</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-2xl font-semibold mb-4">
        Room: {roomCode}
      </h1>
      <p className="mb-2">
        Connection: {connectionStatus}
      </p>
      <p className="mb-6">Active Users: {userCount}</p>

      <button
        onClick={handleTestMessage}
        className="px-4 py-2 bg-purple-600 text-white rounded"
      >
        Send Test Update
      </button>
    </div>
  );
}