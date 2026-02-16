import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    const verificationToken = sessionStorage.getItem("verificationToken");

    if (!verificationToken) {
      alert("Verification token missing");
      return;
    }

    try {
      await api.post(
        "/home/verify-otp",
        { otp },
        {
          headers: {
            Authorization: `Bearer ${verificationToken}`
          }
        }
      );

      sessionStorage.removeItem("verificationToken");
      navigate("/signin");
    } catch (err: any) {
      alert(err.response?.data?.message || "Invalid OTP");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleVerify}
        className="bg-white p-8 rounded-lg shadow-md w-96"
      >
        <h2 className="text-2xl font-semibold mb-6 text-center">
          Verify OTP
        </h2>

        <input
          type="text"
          placeholder="Enter OTP"
          className="w-full mb-6 p-2 border rounded"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full bg-black text-white py-2 rounded hover:opacity-90"
        >
          Verify
        </button>
      </form>
    </div>
  );
}