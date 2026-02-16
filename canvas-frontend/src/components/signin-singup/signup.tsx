import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

export default function Signup() {
  const navigate = useNavigate();
  const [name , setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading ] = useState(false);
    const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return; // prevent double submit

    try {
      setLoading(true);

      const res = await api.post("/home/signup", {
        name,
        email,
        password
      });

      const { verificationToken } = res.data;

      if (!verificationToken) {
        throw new Error("Verification token missing in response");
      }

      sessionStorage.setItem("verificationToken", verificationToken);
      sessionStorage.setItem("email", email);

      navigate("/verify-otp");

    } catch (err: any) {
      alert(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSignup}
        className="bg-white p-8 rounded-lg shadow-md w-96"
      >
        <h2 className="text-2xl font-semibold mb-6 text-center">
          Create Account
        </h2>
        <input 
          type="string"
          placeholder="Name"
          className="w-full mb-4 p-2 border rounded"
          value={name}
          onChange={(e)=> setName(e.target.value)}
          required
        />
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
        disabled={loading}
        className={`w-full py-2 rounded text-white ${
          loading ? "bg-gray-400 cursor-not-allowed" : "bg-black hover:opacity-90"
        }`}
      >
        {loading ? "Creating..." : "Signup"}
      </button>
      </form>
    </div>
  );
}