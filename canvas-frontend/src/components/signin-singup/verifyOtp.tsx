import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

export default function VerifyOtp() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const email = sessionStorage.getItem("email") || "";

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  const handleChange = (val: string, idx: number) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();

    if (val && idx === 5 && next.every(d => d)) {
      handleVerify(next.join(""));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) inputs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      inputs.current[5]?.focus();
      handleVerify(pasted);
    }
    e.preventDefault();
  };

  const handleVerify = async (code: string) => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const token = sessionStorage.getItem("verificationToken") || "";
      const res = await api.post(
        "/home/verify-otp",
        { otp: code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { accessToken, refreshToken, user } = res.data;
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(user));
      sessionStorage.removeItem("verificationToken");
      sessionStorage.removeItem("email");
      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    handleVerify(code);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#080809",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", padding: "24px",
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Cormorant+Garamond:ital,wght@1,300&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes successPop {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.6)} }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(90px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(90px) rotate(-360deg); }
        }
        .fade-up { animation: fadeUp 0.6s ease forwards; opacity: 0; }
        .d1 { animation-delay: 0.05s; }
        .d2 { animation-delay: 0.15s; }
        .d3 { animation-delay: 0.25s; }
        .d4 { animation-delay: 0.35s; }
        .d5 { animation-delay: 0.45s; }
        .otp-input {
          width: 52px; height: 60px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          color: #f0ede8; font-size: 24px; font-weight: 500;
          text-align: center; outline: none;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.2s; caret-color: #8b5cf6;
        }
        .otp-input:focus {
          border-color: rgba(139,92,246,0.6);
          background: rgba(139,92,246,0.06);
          box-shadow: 0 0 0 3px rgba(139,92,246,0.1);
        }
        .otp-input.filled {
          border-color: rgba(139,92,246,0.35);
          background: rgba(139,92,246,0.04);
        }
        .otp-input.error-state {
          border-color: rgba(239,68,68,0.4) !important;
          background: rgba(239,68,68,0.05) !important;
        }
        .verify-btn {
          width: 100%; padding: 14px;
          background: #8b5cf6; color: white; border: none;
          border-radius: 12px; font-size: 15px; font-weight: 500;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          transition: all 0.2s; box-shadow: 0 0 28px rgba(139,92,246,0.25);
          letter-spacing: 0.02em;
        }
        .verify-btn:hover:not(:disabled) {
          background: #7c3aed; transform: translateY(-1px);
          box-shadow: 0 0 40px rgba(139,92,246,0.4);
        }
        .verify-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .success-check { animation: successPop 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
        .pulse-dot { animation: pulse 2s ease-in-out infinite; }
        .orbit-dot {
          width: 4px; height: 4px; borderRadius: 50%;
          background: rgba(139,92,246,0.4);
          position: absolute; top: 50%; left: 50%;
          margin: -2px 0 0 -2px;
          animation: orbit 4s linear infinite;
        }
        .orbit-dot-2 { animation-delay: -2s; animation-duration: 6s; transform: translateX(70px); }
        .orbit-dot-3 { animation-delay: -1s; animation-duration: 8s; transform: translateX(110px); }
        .back-link {
          color: rgba(240,237,232,0.3); font-size: 13px;
          text-decoration: none; display: inline-flex;
          align-items: center; gap: 6px; transition: color 0.2s;
        }
        .back-link:hover { color: rgba(240,237,232,0.7); }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>


      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "relative", width: 1, height: 1 }}>
          <div className="orbit-dot" />
          <div className="orbit-dot orbit-dot-2" />
          <div className="orbit-dot orbit-dot-3" />
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 2 }}>
        
        <a href="/signin" className="back-link fade-up d1" style={{ display: "inline-flex", marginBottom: 40 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to sign in
        </a>

        {success ? (
          
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div className="success-check" style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 400, letterSpacing: "-0.02em", marginBottom: 8 }}>Verified!</h2>
            <p style={{ fontSize: 14, color: "rgba(240,237,232,0.4)" }}>Taking you to your dashboard…</p>
          </div>
        ) : (
          /* OTP form */
          <>
            <div className="fade-up d1" style={{ marginBottom: 40 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, #8b5cf6, #4f46e5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 24, boxShadow: "0 0 32px rgba(139,92,246,0.25)",
              }}>
                <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                  <path d="M2 12L5 7L8 10L11 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 400, letterSpacing: "-0.03em", marginBottom: 10, color: "#f0ede8" }}>
                Check your email
              </h1>
              <p style={{ fontSize: 14, color: "rgba(240,237,232,0.35)", lineHeight: 1.7, fontWeight: 300 }}>
                We sent a 6-digit code to{" "}
                <span style={{ color: "#a78bfa", fontWeight: 500 }}>{email || "your email"}</span>.
                Enter it below to verify your account.
              </p>
            </div>
            
            {error && (
              <div className="fade-up" style={{
                marginBottom: 20, padding: "12px 16px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 10, fontSize: 13, color: "#fca5a5",
              }}>
                {error}
              </div>
            )}

            {/* OTP inputs */}
            <form onSubmit={handleSubmit}>
              <div className="fade-up d2" style={{
                display: "flex", gap: 10, justifyContent: "center", marginBottom: 32,
              }}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { inputs.current[idx] = el; }}
                    className={`otp-input ${digit ? "filled" : ""} ${error ? "error-state" : ""}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleChange(e.target.value, idx)}
                    onKeyDown={e => handleKeyDown(e, idx)}
                    onPaste={idx === 0 ? handlePaste : undefined}
                  />
                ))}
              </div>

              <div className="fade-up d3">
                <button
                  type="submit"
                  className="verify-btn"
                  disabled={loading || otp.some(d => !d)}
                >
                  {loading ? (
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      Verifying...
                    </span>
                  ) : "Verify account →"}
                </button>
              </div>
            </form>

            {/* Hint */}
            <p className="fade-up d4" style={{
              marginTop: 28, textAlign: "center",
              fontSize: 13, color: "rgba(240,237,232,0.25)",
            }}>
              Didn't receive it? Check your spam folder or{" "}
              <button
                onClick={() => navigate("/signup")}
                style={{
                  background: "none", border: "none", color: "#a78bfa",
                  cursor: "pointer", fontSize: 13, fontFamily: "DM Sans, sans-serif",
                  textDecoration: "underline", textDecorationColor: "rgba(167,139,250,0.3)",
                  padding: 0,
                }}
              >
                sign up again
              </button>
            </p>

            <p className="fade-up d5" style={{
              marginTop: 40, textAlign: "center",
              fontSize: 11, color: "rgba(240,237,232,0.12)",
              letterSpacing: "0.04em",
            }}>
              Project Canva · Secure OTP via Brevo
            </p>
          </>
        )}
      </div>
    </div>
  );
}