import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-8">Welcome to ProjectCanva</h1>
      <div className="flex space-x-6">
        <button
          onClick={() => navigate("/join-room")}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Join Room
        </button>
        <button
          onClick={() => navigate("/create-room")}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Create Room
        </button>
      </div>
    </div>
  );
}