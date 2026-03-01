import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

type AuthMode = "signin" | "signup";
interface Props { mode: AuthMode; }

export default function AuthPage({ mode }: Props) {
  const navigate = useNavigate();
  const isSignup = mode === "signup";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  // Particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let w = canvas.width = canvas.offsetWidth;
    let h = canvas.height = canvas.offsetHeight;

    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];
    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 1.2 + 0.3,
        opacity: Math.random() * 0.35 + 0.05,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139,92,246,${p.opacity})`;
        ctx.fill();
      });
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach(b => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(139,92,246,${0.05 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    try {
      setLoading(true);
      if (isSignup) {
        const res = await api.post("/home/signup", { name, email, password });
        const { verificationToken } = res.data;
        sessionStorage.setItem("verificationToken", verificationToken);
        sessionStorage.setItem("email", email);
        navigate("/verify-otp");
      } else {
        const res = await api.post("/home/signin", { email, password });
        const { accessToken, refreshToken, user } = res.data;
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);
        localStorage.setItem("user", JSON.stringify(user));
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string) => ({
    width: "100%",
    padding: "14px 16px",
    background: focused === field ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${focused === field ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 12,
    color: "#f0ede8",
    fontSize: 14,
    outline: "none",
    transition: "all 0.2s",
    boxSizing: "border-box" as const,
  });

  return (
    <div style={{
      minHeight: "100vh", background: "#080809", display: "flex",
      fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Cormorant+Garamond:ital,wght@1,300;1,400&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(240,237,232,0.2); }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px #080809 inset !important;
          -webkit-text-fill-color: #f0ede8 !important;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes slideWord {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes drawStroke {
          from { stroke-dashoffset: 300; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.6); }
        }
        .stroke-draw {
          stroke-dasharray: 300;
          animation: drawStroke 2.5s ease forwards;
        }
        .s2 { animation-delay: 0.6s; }
        .s3 { animation-delay: 1.2s; }
        .s4 { animation-delay: 1.8s; }
        .pulse-dot { animation: pulse 2s ease-in-out infinite; }
        .form-field { animation: fadeUp 0.6s ease forwards; opacity: 0; }
        .f1 { animation-delay: 0.1s; }
        .f2 { animation-delay: 0.2s; }
        .f3 { animation-delay: 0.3s; }
        .f4 { animation-delay: 0.4s; }
        .f5 { animation-delay: 0.5s; }
        .word-reveal { display: inline-block; overflow: hidden; vertical-align: bottom; }
        .word-inner { display: inline-block; animation: slideWord 0.8s cubic-bezier(0.16,1,0.3,1) both; }
        .w1 .word-inner { animation-delay: 0.1s; }
        .w2 .word-inner { animation-delay: 0.28s; }
        .w3 .word-inner { animation-delay: 0.46s; }
        .submit-btn {
          width: 100%; padding: 14px;
          background: #8b5cf6; color: white;
          border: none; border-radius: 12px;
          font-size: 15px; font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; letter-spacing: 0.02em;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 0 28px rgba(139,92,246,0.25);
        }
        .submit-btn:hover:not(:disabled) {
          background: #7c3aed;
          transform: translateY(-1px);
          box-shadow: 0 0 40px rgba(139,92,246,0.4);
        }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .back-link {
          color: rgba(240,237,232,0.3); font-size: 13px;
          text-decoration: none; display: inline-flex;
          align-items: center; gap: 6px;
          transition: color 0.2s;
        }
        .back-link:hover { color: rgba(240,237,232,0.7); }
        .toggle-btn {
          background: none; border: none; padding: 0;
          color: #a78bfa; font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; font-weight: 500;
          transition: color 0.2s;
          text-decoration: underline; text-decoration-color: rgba(167,139,250,0.3);
        }
        .toggle-btn:hover { color: #c4b5fd; }
        .show-pass-btn {
          position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: rgba(240,237,232,0.25); cursor: pointer;
          font-size: 12px; padding: 4px;
          font-family: 'DM Sans', sans-serif;
          transition: color 0.2s; letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .show-pass-btn:hover { color: rgba(240,237,232,0.6); }
      `}</style>

      {/* LEFT PANEL visual */}
      <div style={{
        display: "none",
        width: "52%",
        position: "relative",
        overflow: "hidden",
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }} className="left-panel">
        <canvas ref={canvasRef} style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
        }} />

        {/* Content */}
        <div style={{
          position: "relative", zIndex: 2,
          height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "48px 56px",
        }}>
          {/* Logo */}
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg, #8b5cf6, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 12L5 7L8 10L11 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ color: "#f0ede8", fontWeight: 600, fontSize: 15 }}>Project Canva</span>
          </a>

          {/* Center headline */}
          <div>
            <h2 style={{
              fontSize: "clamp(40px, 5vw, 72px)",
              fontWeight: 300, lineHeight: 1.05,
              letterSpacing: "-0.04em", marginBottom: 24,
            }}>
              <div style={{ overflow: "hidden" }}>
                <span className="word-reveal w1">
                  <span className="word-inner">Draw</span>
                </span>
              </div>
              <div style={{ overflow: "hidden" }}>
                <span className="word-reveal w2" style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic", fontWeight: 300,
                  color: "rgba(240,237,232,0.45)",
                }}>
                  <span className="word-inner">together,</span>
                </span>
              </div>
              <div style={{ overflow: "hidden" }}>
                <span className="word-reveal w3" style={{
                  background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 20px rgba(139,92,246,0.4))",
                }}>
                  <span className="word-inner">create.</span>
                </span>
              </div>
            </h2>

            <p style={{
              fontSize: 15, color: "rgba(240,237,232,0.35)",
              lineHeight: 1.75, fontWeight: 300, maxWidth: 360,
            }}>
              Real-time collaboration with sub-50ms sync, cursor presence, and undo/redo — all backed by Redis and WebSockets.
            </p>

            {/* Mini canvas preview */}
            <div style={{
              marginTop: 48,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: "24px 24px 16px",
              position: "relative",
            }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {["#ff5f57","#ffbd2e","#28c840"].map(c => (
                  <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.7 }} />
                ))}
                <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginLeft: 6 }} />
              </div>
              <svg width="100%" height="120" viewBox="0 0 380 120">
                {/* Ghost cursors */}
                <g transform="translate(30,20)">
                  <polygon points="0,0 0,14 3,10 6,16 8,15 5,9 10,9" fill="#8b5cf6" opacity="0.9"/>
                  <rect x="12" y="3" width="44" height="13" rx="6" fill="#8b5cf6" opacity="0.8"/>
                  <text x="34" y="13" textAnchor="middle" fill="white" fontSize="7.5" fontFamily="DM Sans">Sarvesh</text>
                </g>
                <g transform="translate(290,80)">
                  <polygon points="0,0 0,14 3,10 6,16 8,15 5,9 10,9" fill="#06b6d4" opacity="0.9"/>
                  <rect x="12" y="3" width="34" height="13" rx="6" fill="#06b6d4" opacity="0.8"/>
                  <text x="29" y="13" textAnchor="middle" fill="white" fontSize="7.5" fontFamily="DM Sans">Haha</text>
                </g>
                {/* Strokes */}
                <path className="stroke-draw" d="M 30 90 Q 80 40 140 70 Q 200 100 260 40" stroke="#8b5cf6" strokeWidth="2" fill="none" strokeLinecap="round"/>
                <path className="stroke-draw s2" d="M 160 100 Q 210 50 270 80 Q 320 100 360 60" stroke="#06b6d4" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <path className="stroke-draw s3" d="M 20 50 Q 80 90 160 40 Q 220 10 280 55" stroke="#10b981" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
              {/* Live indicator */}
              <div style={{
                position: "absolute", top: 14, right: 14,
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 10, color: "#10b981",
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.2)",
                borderRadius: 100, padding: "3px 10px",
              }}>
                <span className="pulse-dot" style={{ width: 4, height: 4, borderRadius: "50%", background: "#10b981", display: "inline-block" }}/>
                live
              </div>
            </div>
          </div>

          {/* Bottom stats */}
          <div style={{ display: "flex", gap: 40 }}>
            {[["<10ms", "sync"], ["50ms", "cursor"], ["24hr", "rooms"]].map(([v, l]) => (
              <div key={v}>
                <div style={{ fontSize: 20, fontWeight: 300, color: "#c4b5fd", letterSpacing: "-0.03em" }}>{v}</div>
                <div style={{ fontSize: 10, color: "rgba(240,237,232,0.25)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/*  RIGHT PANEL */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "48px 24px", position: "relative",
      }}>
        {/* Mobile particle canvas */}
        <canvas ref={canvasRef} style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          pointerEvents: "none",
        }} />

        <div style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 2 }}>
          {/* Back to home */}
          <a href="/" className="back-link" style={{ display: "inline-flex", marginBottom: 40 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back to home
          </a>

          {/* Logo mark */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg, #8b5cf6, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 24,
              boxShadow: "0 0 32px rgba(139,92,246,0.25)",
            }}>
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none">
                <path d="M2 12L5 7L8 10L11 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h1 style={{
              fontSize: 28, fontWeight: 400, letterSpacing: "-0.03em",
              marginBottom: 8, color: "#f0ede8",
            }}>
              {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p style={{ fontSize: 14, color: "rgba(240,237,232,0.35)", fontWeight: 300 }}>
              {isSignup
                ? "Start drawing with your team in seconds."
                : "Sign in to continue to Project Canva."}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="form-field f1" style={{
              marginBottom: 20, padding: "12px 16px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 10, fontSize: 13, color: "#fca5a5",
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isSignup && (
              <div className="form-field f1">
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onFocus={() => setFocused("name")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle("name")}
                  required
                />
              </div>
            )}

            <div className={`form-field ${isSignup ? "f2" : "f1"}`}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                style={inputStyle("email")}
                required
              />
            </div>

            <div className={`form-field ${isSignup ? "f3" : "f2"}`} style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                style={{ ...inputStyle("password"), paddingRight: 60 }}
                required
              />
              <button
                type="button"
                className="show-pass-btn"
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? "hide" : "show"}
              </button>
            </div>

            <div className={`form-field ${isSignup ? "f4" : "f3"}`} style={{ marginTop: 6 }}>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    {isSignup ? "Creating account..." : "Signing in..."}
                  </span>
                ) : (
                  isSignup ? "Create account →" : "Sign in →"
                )}
              </button>
            </div>
          </form>

          {/* Toggle */}
          <p className={`form-field ${isSignup ? "f5" : "f4"}`} style={{
            marginTop: 28, textAlign: "center",
            fontSize: 14, color: "rgba(240,237,232,0.3)",
          }}>
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button
              className="toggle-btn"
              onClick={() => navigate(isSignup ? "/signin" : "/signup")}
            >
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </p>

          {/* Footer */}
          <p style={{
            marginTop: 48, textAlign: "center",
            fontSize: 11, color: "rgba(240,237,232,0.15)",
            letterSpacing: "0.04em",
          }}>
            Project Canva · WebSockets · Redis · TypeScript
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (min-width: 768px) {
          .left-panel { display: flex !important; }
        }
      `}</style>
    </div>
  );
}