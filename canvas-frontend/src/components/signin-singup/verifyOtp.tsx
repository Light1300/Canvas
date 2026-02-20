import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("[VerifyOtp] Mounted");
    console.log(
      "[VerifyOtp] Stored email:",
      sessionStorage.getItem("email") || "NOT FOUND"
    );
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("[VerifyOtp] Form submitted");

    if (loading) {
      console.warn("[VerifyOtp] Prevented duplicate verification request");
      return;
    }

    const token = sessionStorage.getItem("verificationToken");
    console.log(
      "[VerifyOtp] Retrieved verification token:",
      token ? "FOUND" : "MISSING"
    );

    if (!token) {
      console.error("[VerifyOtp] Session expired - token missing");
      setError("Session expired. Please sign up again.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      console.log("[VerifyOtp] Sending OTP verification request", {
        otpLength: otp.length
      });

      const res = await api.post(
        "/home/verify-otp",
        { otp },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("[VerifyOtp] OTP verification success:", res.data);

      const { accessToken, refreshToken } = res.data;

      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      console.log("[VerifyOtp] Stored access & refresh tokens");

      sessionStorage.removeItem("verificationToken");
      sessionStorage.removeItem("email");

      console.log("[VerifyOtp] Cleared verification session storage");
      console.log("[VerifyOtp] Navigating to /dashboard");

      navigate("/dashboard");
    } catch (err: any) {
      console.error("[VerifyOtp] OTP verification failed");

      if (err.response) {
        console.error("[VerifyOtp] Server error:", {
          status: err.response.status,
          data: err.response.data
        });
        setError(err.response.data?.message || "Invalid OTP.");
      } else if (err.request) {
        console.error("[VerifyOtp] No response received:", err.request);
        setError("Network error. Please try again.");
      } else {
        console.error("[VerifyOtp] Unexpected error:", err.message);
        setError("Unexpected error occurred.");
      }
    } finally {
      setLoading(false);
      console.log("[VerifyOtp] Loading reset");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Check your email
        </h2>
        <p className="text-gray-500 mb-8 text-sm">
          We sent a 6-digit code to{" "}
          {sessionStorage.getItem("email") || "your email"}.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            placeholder="Enter 6-digit OTP"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              const sanitized = e.target.value.replace(/\D/g, "");
              console.log("[VerifyOtp] OTP updated:", sanitized);
              setOtp(sanitized);
            }}
            className="w-full p-3 border border-gray-300 rounded-lg text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-400"
            required
          />
          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className={`w-full py-3 rounded-lg text-white font-medium transition ${
              loading || otp.length !== 6
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
      </div>
    </div>
  );
}