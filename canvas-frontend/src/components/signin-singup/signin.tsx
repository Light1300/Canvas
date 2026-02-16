import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

export default function Signin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.post("/home/signin", {
        email,
        password
      });

      navigate("/dashboard"); // we’ll build later
    } catch (err: any) {
      alert(err.response?.data?.message || "Signin failed");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSignin}
        className="bg-white p-8 rounded-lg shadow-md w-96"
      >
        <h2 className="text-2xl font-semibold mb-6 text-center">
          Sign In
        </h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-4 p-2 border rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-6 p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full bg-black text-white py-2 rounded hover:opacity-90"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}