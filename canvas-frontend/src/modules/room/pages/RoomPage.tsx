import { useParams } from "react-router-dom";
import { useRoomSocket } from "../../../hooks/useRoomSocket";

export const RoomPage = () => {
  const { roomId = "" } = useParams();
  const { userCount } = useRoomSocket(roomId);

  return (
    <div>
      <h1>Room {roomId}</h1>
      <p>Active users: {userCount}</p>
    </div>
  );
};