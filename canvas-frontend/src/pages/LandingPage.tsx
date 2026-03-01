import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);

  // canvas floating particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.05,
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
      // Draw subtle connecting lines
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach(b => {
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(139,92,246,${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    setTimeout(() => setLoaded(true), 100);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="relative min-h-screen bg-[#080809] text-white overflow-x-hidden"
      onMouseMove={handleMouseMove}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --violet: #8b5cf6;
          --violet-dim: #6d28d9;
          --violet-glow: rgba(139,92,246,0.15);
          --off-white: #f0ede8;
          --muted: rgba(240,237,232,0.35);
          --border: rgba(240,237,232,0.07);
        }

        html { scroll-behavior: smooth; }

        /* Fade-in on load */
        .fade-up {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1);
        }
        .fade-up.visible { opacity: 1; transform: translateY(0); }

        /* Staggered delays */
        .d1 { transition-delay: 0.1s; }
        .d2 { transition-delay: 0.25s; }
        .d3 { transition-delay: 0.4s; }
        .d4 { transition-delay: 0.55s; }
        .d5 { transition-delay: 0.7s; }
        .d6 { transition-delay: 0.85s; }

        /* Hero words animation */
        @keyframes slideWord {
          0% { opacity: 0; transform: translateY(100%); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .word-reveal {
          display: inline-block;
          overflow: hidden;
          vertical-align: bottom;
        }
        .word-inner {
          display: inline-block;
          animation: slideWord 0.85s cubic-bezier(0.16,1,0.3,1) both;
        }
        .w1 .word-inner { animation-delay: 0.2s; }
        .w2 .word-inner { animation-delay: 0.38s; }
        .w3 .word-inner { animation-delay: 0.56s; }
        .w4 .word-inner { animation-delay: 0.74s; }
        .w5 .word-inner { animation-delay: 0.92s; }
        .w6 .word-inner { animation-delay: 1.1s; }

        /* Glowing violet text */
        .glow-text {
          background: linear-gradient(135deg, #a78bfa, #7c3aed, #c4b5fd);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 24px rgba(139,92,246,0.5));
        }

        /* Italic serif accent */
        .serif-italic {
          font-family: 'Cormorant Garamond', serif;
          font-style: italic;
          font-weight: 300;
        }

        /* Architecture card hover */
        .arch-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          transition: background 0.3s, border-color 0.3s, transform 0.3s;
        }
        .arch-card:hover {
          background: rgba(139,92,246,0.05);
          border-color: rgba(139,92,246,0.25);
          transform: translateY(-4px);
        }

        /* Scroll-triggered animation */
        .scroll-reveal {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1);
        }
        .scroll-reveal.in-view { opacity: 1; transform: translateY(0); }

        /* Grain overlay */
        .grain::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.025;
          pointer-events: none;
          z-index: 999;
        }

        /* Nav link */
        .nav-link {
          color: rgba(240,237,232,0.45);
          font-size: 13px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-decoration: none;
          transition: color 0.2s;
        }
        .nav-link:hover { color: var(--off-white); }

        /* CTA button */
        .cta-btn {
          background: var(--violet);
          color: white;
          border: none;
          padding: 14px 36px;
          border-radius: 100px;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 0 32px rgba(139,92,246,0.3);
        }
        .cta-btn:hover {
          background: #7c3aed;
          transform: translateY(-2px);
          box-shadow: 0 0 48px rgba(139,92,246,0.5);
        }

        /* Ghost button */
        .ghost-btn {
          background: transparent;
          color: var(--off-white);
          border: 1px solid var(--border);
          padding: 13px 32px;
          border-radius: 100px;
          font-size: 14px;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          text-decoration: none;
          display: inline-block;
        }
        .ghost-btn:hover {
          border-color: rgba(139,92,246,0.5);
          background: rgba(139,92,246,0.05);
        }

        /* Flow line */
        .flow-line {
          stroke-dasharray: 800;
          stroke-dashoffset: 800;
          animation: drawLine 2s ease forwards;
        }
        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }

        /* Pulse dot */
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.5); }
        }
        .pulse-dot { animation: pulse 2s ease-in-out infinite; }

        /* Feature pill */
        .feature-pill {
          border: 1px solid var(--border);
          padding: 8px 16px;
          border-radius: 100px;
          font-size: 12px;
          color: var(--muted);
          letter-spacing: 0.06em;
          white-space: nowrap;
          transition: border-color 0.2s, color 0.2s;
        }
        .feature-pill:hover { border-color: rgba(139,92,246,0.4); color: #c4b5fd; }

        /* Footer link */
        .footer-link {
          color: rgba(240,237,232,0.3);
          text-decoration: none;
          font-size: 13px;
          transition: color 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .footer-link:hover { color: var(--off-white); }

        /* Section divider */
        .section-divider {
          width: 1px;
          height: 80px;
          background: linear-gradient(to bottom, transparent, rgba(139,92,246,0.4), transparent);
          margin: 0 auto;
        }

        /* Marquee */
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-inner {
          display: flex;
          animation: marquee 20s linear infinite;
          width: max-content;
        }
        .marquee-inner:hover { animation-play-state: paused; }

        /* Canvas preview mock */
        @keyframes drawStroke {
          from { stroke-dashoffset: 300; }
          to { stroke-dashoffset: 0; }
        }
        .stroke-anim {
          stroke-dasharray: 300;
          animation: drawStroke 2s ease forwards;
        }
        .stroke-anim-2 { animation-delay: 0.5s; }
        .stroke-anim-3 { animation-delay: 1s; }
        .stroke-anim-4 { animation-delay: 1.5s; }
      `}</style>

      {/* Grain */}
      <div className="grain" />

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
      />

      {/* Mouse glow follower */}
      <div
        style={{
          position: "fixed",
          left: mousePos.x - 200,
          top: mousePos.y - 200,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 1,
          transition: "left 0.1s, top 0.1s",
        }}
      />

      {/* NAV  */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "20px 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(16px)",
        background: "rgba(8,8,9,0.7)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #8b5cf6, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 12L5 7L8 10L11 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.02em" }}>Project Canva</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="#architecture" className="nav-link">Architecture</a>
          <a href="#features" className="nav-link">Features</a>
          <a href="https://canvas-production-671b.up.railway.app/api-docs/" target="_blank" rel="noreferrer" className="nav-link">API Docs</a>
          <a href="https://github.com/Light1300/Canvas" target="_blank" rel="noreferrer" className="nav-link">GitHub</a>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button className="ghost-btn" onClick={() => navigate("/signin")} style={{ padding: "10px 24px", fontSize: 13 }}>
            Sign in
          </button>
          <button className="cta-btn" onClick={() => navigate("/signup")} style={{ padding: "10px 24px", fontSize: 13 }}>
            Get started
          </button>
        </div>
      </nav>

      {/* HERO  */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "120px 24px 80px",
        position: "relative", zIndex: 2,
      }}>
        {/* Eyebrow */}
        <div className={`fade-up d1 ${loaded ? "visible" : ""}`} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          border: "1px solid rgba(139,92,246,0.3)",
          borderRadius: 100, padding: "6px 16px",
          fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase",
          color: "#a78bfa", marginBottom: 48,
          background: "rgba(139,92,246,0.05)",
        }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6", display: "inline-block" }} />
          Real-time Collaborative Whiteboard
        </div>

        {/* Hero headline */}
        <h1 style={{
          fontSize: "clamp(52px, 9vw, 120px)",
          fontWeight: 300,
          lineHeight: 1.0,
          letterSpacing: "-0.04em",
          marginBottom: 0,
          maxWidth: 900,
        }}>
          <div style={{ overflow: "hidden", marginBottom: "0.1em" }}>
            <span className="word-reveal w1" style={{ marginRight: "0.25em" }}>
              <span className="word-inner">Project</span>
            </span>
            <span className="word-reveal w2">
              <span className="word-inner glow-text">Canva</span>
            </span>
          </div>
          <div style={{ overflow: "hidden", marginBottom: "0.1em" }}>
            <span className="word-reveal w3 serif-italic" style={{ fontSize: "0.85em", color: "rgba(240,237,232,0.55)", marginRight: "0.2em" }}>
              <span className="word-inner">empowers</span>
            </span>
          </div>
          <div style={{ overflow: "hidden" }}>
            <span className="word-reveal w4" style={{ marginRight: "0.2em" }}>
              <span className="word-inner">visionaries</span>
            </span>
            <span className="word-reveal w5 serif-italic" style={{ color: "rgba(240,237,232,0.45)", marginRight: "0.2em" }}>
              <span className="word-inner">to</span>
            </span>
          </div>
          <div style={{ overflow: "hidden" }}>
            <span className="word-reveal w6 glow-text">
              <span className="word-inner">draw together.</span>
            </span>
          </div>
        </h1>

        {/* Subheadline */}
        <p className={`fade-up d4 ${loaded ? "visible" : ""}`} style={{
          marginTop: 48, fontSize: 17, color: "rgba(240,237,232,0.45)",
          maxWidth: 560, lineHeight: 1.75, fontWeight: 300,
        }}>
          A production-grade real-time whiteboard. Draw, collaborate, and create with your team — strokes sync in milliseconds, cursors float in real time, and every session is perfectly orchestrated by Redis and WebSockets.
        </p>

        {/* CTAs */}
        <div className={`fade-up d5 ${loaded ? "visible" : ""}`} style={{
          marginTop: 52, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "center",
        }}>
          <button className="cta-btn" onClick={() => navigate("/signup")}>
            Start drawing free →
          </button>
          <a href="https://canvas-production-671b.up.railway.app/api-docs/" target="_blank" rel="noreferrer" className="ghost-btn">
            Explore API docs
          </a>
        </div>

        {/* Stats */}
        <div className={`fade-up d6 ${loaded ? "visible" : ""}`} style={{
          marginTop: 80, display: "flex", gap: 48, justifyContent: "center", flexWrap: "wrap",
        }}>
          {[
            ["<10ms", "Heartbeat detection"],
            ["50ms", "Cursor throttle"],
            ["24hr", "Room lifetime"],
            ["∞", "Concurrent users"],
          ].map(([val, label]) => (
            <div key={val} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.03em", color: "#c4b5fd" }}>{val}</div>
              <div style={{ fontSize: 11, color: "rgba(240,237,232,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Canvas preview mock */}
        <div className={`fade-up d6 ${loaded ? "visible" : ""}`} style={{
          marginTop: 80, width: "100%", maxWidth: 800,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 20, padding: 32, position: "relative",
          overflow: "hidden",
        }}>
          {/* Window chrome */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {["#ff5f57","#ffbd2e","#28c840"].map(c => (
              <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.7 }} />
            ))}
            <div style={{ flex: 1, height: 10, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginLeft: 8 }} />
          </div>
          <svg width="100%" height="200" viewBox="0 0 740 200" style={{ display: "block" }}>
            {/* Ghost cursors */}
            <g transform="translate(80, 40)">
              <polygon points="0,0 0,20 5,14 9,22 11,21 7,13 14,13" fill="#8b5cf6" opacity="0.9"/>
              <rect x="16" y="6" width="52" height="16" rx="8" fill="#8b5cf6" opacity="0.8"/>
              <text x="42" y="18" textAnchor="middle" fill="white" fontSize="9" fontFamily="DM Sans">Sarvesh</text>
            </g>
            <g transform="translate(580, 120)">
              <polygon points="0,0 0,20 5,14 9,22 11,21 7,13 14,13" fill="#06b6d4" opacity="0.9"/>
              <rect x="16" y="6" width="38" height="16" rx="8" fill="#06b6d4" opacity="0.8"/>
              <text x="35" y="18" textAnchor="middle" fill="white" fontSize="9" fontFamily="DM Sans">Haha</text>
            </g>
            <g transform="translate(320, 160)">
              <polygon points="0,0 0,20 5,14 9,22 11,21 7,13 14,13" fill="#10b981" opacity="0.9"/>
              <rect x="16" y="6" width="44" height="16" rx="8" fill="#10b981" opacity="0.8"/>
              <text x="38" y="18" textAnchor="middle" fill="white" fontSize="9" fontFamily="DM Sans">Sneha</text>
            </g>
            {/* Strokes */}
            <path className="stroke-anim" d="M 60 160 Q 120 80 200 120 Q 280 160 340 60" stroke="#8b5cf6" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            <path className="stroke-anim stroke-anim-2" d="M 350 140 Q 420 60 500 100 Q 560 130 620 80" stroke="#06b6d4" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path className="stroke-anim stroke-anim-3" d="M 100 40 Q 160 100 240 60 Q 300 30 380 90" stroke="#10b981" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <path className="stroke-anim stroke-anim-4" d="M 440 170 Q 510 110 580 150 Q 640 180 700 120" stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
          {/* Live badge */}
          <div style={{
            position: "absolute", top: 16, right: 16,
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 100, padding: "4px 12px", fontSize: 11, color: "#10b981",
          }}>
            <span className="pulse-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", display: "inline-block" }}/>
            3 drawing live
          </div>
        </div>
      </section>

      {/* MARQUEE TECH STRIP  */}
      <div style={{
        borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
        padding: "20px 0", overflow: "hidden", position: "relative", zIndex: 2,
        background: "rgba(255,255,255,0.01)",
      }}>
        <div className="marquee-inner">
          {["WebSockets", "Redis Pub/Sub", "JWT Auth", "Rate Limiting", "Undo/Redo", "Cursor Presence", "Stroke History", "Docker", "Railway", "TypeScript", "MongoDB", "Swagger API", "WebSockets", "Redis Pub/Sub", "JWT Auth", "Rate Limiting", "Undo/Redo", "Cursor Presence", "Stroke History", "Docker", "Railway", "TypeScript", "MongoDB", "Swagger API"].map((t, i) => (
            <span key={i} style={{
              margin: "0 32px", fontSize: 12, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "rgba(240,237,232,0.2)",
              display: "flex", alignItems: "center", gap: 16, whiteSpace: "nowrap",
            }}>
              <span style={{ color: "#8b5cf6", opacity: 0.5 }}>✦</span>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" style={{ padding: "120px 48px", position: "relative", zIndex: 2, maxWidth: 1200, margin: "0 auto" }}>
        <div className="scroll-reveal" style={{ textAlign: "center", marginBottom: 80 }}>
          <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8b5cf6", marginBottom: 20 }}>WHAT WE BUILT</p>
          <h2 style={{ fontSize: "clamp(36px,5vw,64px)", fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Every feature<br />
            <span className="serif-italic" style={{ color: "rgba(240,237,232,0.45)" }}>engineered to production</span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {[
            {
              icon: "⚡", title: "Real-Time Sync",
              desc: "Strokes broadcast via Redis Pub/Sub across all server instances in under 10ms. Zero in-memory state — fully horizontal-scale ready.",
              tag: "WebSocket + Redis",
            },
            {
              icon: "👁", title: "Cursor Presence",
              desc: "See your team's cursors floating in real time with names and unique colors. Throttled to 20 events/second — smooth without flooding.",
              tag: "CURSOR_MOVE events",
            },
            {
              icon: "↩", title: "Undo / Redo",
              desc: "Per-user stroke stacks with server-side ownership enforcement. User A cannot undo User B's stroke — enforced at the Redis layer.",
              tag: "strokeId + userId",
            },
            {
              icon: "🔐", title: "Refresh Token Rotation",
              desc: "Every token refresh issues a new pair and invalidates the old. Reuse attack detection built-in — stolen tokens are single-use.",
              tag: "Redis SHA-256 hash",
            },
            {
              icon: "🚦", title: "Rate Limiting",
              desc: "Redis-backed rate limiting survives server restarts and works across instances. Separate limits for auth, room creation, and refresh.",
              tag: "express-rate-limit",
            },
            {
              icon: "🕒", title: "Late Join Catch-Up",
              desc: "Join mid-session and instantly see everything drawn. Full stroke history replayed from Redis RPUSH list — pixel-perfect replay.",
              tag: "INITIAL_STATE event",
            },
            {
              icon: "🩺", title: "Health Monitoring",
              desc: "Live health and readiness endpoints probe Redis and MongoDB. Railway auto-restarts on failure — zero manual intervention.",
              tag: "/health + /ready",
            },
            {
              icon: "📖", title: "Swagger API Docs",
              desc: "Full interactive API documentation. Test every endpoint live with JWT auth. Import directly into Postman via /api-docs.json.",
              tag: "swagger-jsdoc",
            },
            {
              icon: "🐳", title: "Production Docker",
              desc: "Multi-stage build — TypeScript compiled in builder stage, only dist/ copied to production. No source code or devDeps in final image.",
              tag: "Multi-stage Dockerfile",
            },
          ].map((f, i) => (
            <div key={i} className="arch-card scroll-reveal" style={{ borderRadius: 16, padding: 28 }}>
              <div style={{ fontSize: 28, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 500, marginBottom: 10, letterSpacing: "-0.02em" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "rgba(240,237,232,0.4)", lineHeight: 1.75, marginBottom: 16 }}>{f.desc}</p>
              <span style={{
                fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
                color: "#8b5cf6", background: "rgba(139,92,246,0.1)",
                padding: "4px 10px", borderRadius: 100,
              }}>{f.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section id="architecture" style={{ padding: "120px 48px", position: "relative", zIndex: 2, background: "rgba(255,255,255,0.01)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="scroll-reveal" style={{ textAlign: "center", marginBottom: 80 }}>
            <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8b5cf6", marginBottom: 20 }}>SYSTEM DESIGN</p>
            <h2 style={{ fontSize: "clamp(36px,5vw,64px)", fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              Architecture<br />
              <span className="serif-italic" style={{ color: "rgba(240,237,232,0.45)" }}>overview</span>
            </h2>
          </div>

          {/* Architecture diagram */}
          <div className="scroll-reveal" style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid var(--border)",
            borderRadius: 20, padding: 48, fontFamily: "monospace",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: 0, alignItems: "center" }}>
              {/* Client */}
              <div style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 12, padding: "20px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>🖥️</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>React Client</div>
                <div style={{ fontSize: 11, color: "rgba(240,237,232,0.4)", lineHeight: 1.6 }}>
                  Canvas.tsx<br/>useRoomSocket.ts<br/>GhostCursors.tsx
                </div>
              </div>

              {/* Arrow 1 */}
              <div style={{ textAlign: "center", padding: "0 12px" }}>
                <div style={{ fontSize: 10, color: "#8b5cf6", marginBottom: 4 }}>HTTPS</div>
                <div style={{ color: "rgba(139,92,246,0.5)", fontSize: 20 }}>⟷</div>
                <div style={{ fontSize: 10, color: "#8b5cf6", marginTop: 4 }}>WSS</div>
              </div>

              {/* Backend */}
              <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: "20px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>⚙️</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Node.js Backend</div>
                <div style={{ fontSize: 11, color: "rgba(240,237,232,0.4)", lineHeight: 1.6 }}>
                  Express HTTP<br/>ws WebSocket<br/>Rate Limiter
                </div>
              </div>

              {/* Arrow 2 */}
              <div style={{ textAlign: "center", padding: "0 12px" }}>
                <div style={{ fontSize: 10, color: "#06b6d4", marginBottom: 4 }}>Pub/Sub</div>
                <div style={{ color: "rgba(6,182,212,0.5)", fontSize: 20 }}>⟷</div>
                <div style={{ fontSize: 10, color: "#06b6d4", marginTop: 4 }}>R/W</div>
              </div>

              {/* Data stores */}
              <div>
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "16px", textAlign: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 18, marginBottom: 6 }}>⚡</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Redis</div>
                  <div style={{ fontSize: 11, color: "rgba(240,237,232,0.4)", lineHeight: 1.6 }}>
                    Sets · Lists<br/>Pub/Sub · TTL
                  </div>
                </div>
                <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, marginBottom: 6 }}>🍃</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>MongoDB</div>
                  <div style={{ fontSize: 11, color: "rgba(240,237,232,0.4)", lineHeight: 1.6 }}>
                    Users · Rooms<br/>TTL Index
                  </div>
                </div>
              </div>
            </div>

            {/* Flow description */}
            <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 16 }}>
              {[
                { step: "01", label: "JWT verified at WS upgrade handshake — before connection established" },
                { step: "02", label: "Strokes RPUSH'd to Redis List → published to room channel" },
                { step: "03", label: "All instances PSUBSCRIBE room:* → forward to local sockets" },
                { step: "04", label: "Late joiners receive INITIAL_STATE from full Redis stroke list" },
              ].map(({ step, label }) => (
                <div key={step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, color: "#8b5cf6", fontFamily: "monospace", flexShrink: 0, marginTop: 2 }}>{step}</span>
                  <span style={{ fontSize: 12, color: "rgba(240,237,232,0.45)", lineHeight: 1.65 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Redis key design */}
          <div className="scroll-reveal" style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: 16 }}>
            {[
              { key: "room:{id}:users", type: "Set", desc: "Active connectionIds. SADD/SREM O(1). Ghost sweep on JOIN_ROOM." },
              { key: "room:{id}:strokes", type: "List", desc: "Ordered stroke history. RPUSH to append, LRANGE for full replay." },
              { key: "refresh:{sha256}", type: "String+TTL", desc: "Hashed refresh tokens. Single-use rotation. 30d TTL." },
              { key: "rl:{type}:{ip}", type: "String+TTL", desc: "Rate limit counters per window. Shared across all instances." },
            ].map(({ key, type, desc }) => (
              <div key={key} style={{
                background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)",
                borderRadius: 12, padding: 20,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <code style={{ fontSize: 12, color: "#a78bfa" }}>{key}</code>
                  <span style={{ fontSize: 10, color: "#06b6d4", background: "rgba(6,182,212,0.1)", padding: "2px 8px", borderRadius: 100 }}>{type}</span>
                </div>
                <p style={{ fontSize: 12, color: "rgba(240,237,232,0.4)", lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TECH PILLS */}
      <section style={{ padding: "100px 48px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <div className="scroll-reveal">
            <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8b5cf6", marginBottom: 20 }}>THE STACK</p>
            <h2 style={{ fontSize: "clamp(32px,4vw,52px)", fontWeight: 300, letterSpacing: "-0.03em", marginBottom: 48 }}>
              Every choice was<br/>
              <span className="serif-italic" style={{ color: "rgba(240,237,232,0.45)" }}>deliberate</span>
            </h2>
          </div>
          <div className="scroll-reveal" style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {["React 18", "TypeScript strict", "Node.js 20", "Express 4", "ws library", "Redis 7", "ioredis", "MongoDB Atlas", "Mongoose", "JWT", "bcrypt", "swagger-jsdoc", "express-rate-limit", "Docker multi-stage", "Railway", "Caddy", "Brevo Email", "Tailwind CSS"].map(t => (
              <span key={t} className="feature-pill">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CONNECT / FOOTER */}
      <footer style={{
        borderTop: "1px solid var(--border)", position: "relative", zIndex: 2,
        padding: "80px 48px 48px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 48, marginBottom: 64 }}>
            {/* Brand */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "linear-gradient(135deg, #8b5cf6, #4f46e5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 12L5 7L8 10L11 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ fontWeight: 600, fontSize: 15 }}>Project Canva</span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(240,237,232,0.35)", lineHeight: 1.75, maxWidth: 260 }}>
                A production-grade real-time collaborative whiteboard. Built with WebSockets, Redis, and TypeScript.
              </p>
            </div>

            {/* Project links */}
            <div>
              <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(240,237,232,0.25)", marginBottom: 20 }}>Project</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <a href="https://canva-frontend-production.up.railway.app/" target="_blank" rel="noreferrer" className="footer-link">
                  <span>🎨</span> Live Demo
                </a>
                <a href="https://canvas-production-671b.up.railway.app/api-docs/" target="_blank" rel="noreferrer" className="footer-link">
                  <span>📖</span> Swagger API Docs
                </a>
                <a href="https://github.com/Light1300/Canvas" target="_blank" rel="noreferrer" className="footer-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.1.82-.26.82-.57v-2.2c-3.34.72-4.04-1.6-4.04-1.6-.54-1.38-1.33-1.74-1.33-1.74-1.08-.74.08-.72.08-.72 1.2.08 1.83 1.23 1.83 1.23 1.06 1.82 2.8 1.3 3.48.99.1-.77.41-1.3.75-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.68.82.57C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>
                  GitHub Repository
                </a>
                <a href="https://canvas-production-671b.up.railway.app/health" target="_blank" rel="noreferrer" className="footer-link">
                  <span>🩺</span> API Health
                </a>
              </div>
            </div>

            {/* Connect with me */}
            <div>
              <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(240,237,232,0.25)", marginBottom: 20 }}>Connect with me</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <a href="https://www.linkedin.com/in/sarvesh-patil-559b3124b/" target="_blank" rel="noreferrer" className="footer-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.3zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.21 24 24 23.23 24 22.27V1.73C24 .77 23.21 0 22.22 0z"/></svg>
                  Sarvesh Patil
                </a>
                <a href="https://x.com/SarveshPat21415" target="_blank" rel="noreferrer" className="footer-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  @SarveshPat21415
                </a>
                <a href="https://www.youtube.com/channel/UCskPQR_7HDAo_qjwZ_JMWUg" target="_blank" rel="noreferrer" className="footer-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/></svg>
                  YouTube Channel
                </a>
                <a href="mailto:sarupatil0001@gmail.com" className="footer-link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>
                  sarupatil0001@gmail.com
                </a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            borderTop: "1px solid var(--border)", paddingTop: 32,
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
          }}>
            <p style={{ fontSize: 12, color: "rgba(240,237,232,0.2)" }}>
              © 2026 Sarvesh Patil. Built with TypeScript, Redis, and WebSockets.
            </p>
            <p style={{ fontSize: 12, color: "rgba(240,237,232,0.2)", fontFamily: "monospace" }}>
              AP system · Redis Pub/Sub · ~10ms sync
            </p>
          </div>
        </div>
      </footer>

      {/* Scroll reveal observer */}
      <ScrollObserver />
    </div>
  );
}

function ScrollObserver() {
  useEffect(() => {
    const els = document.querySelectorAll(".scroll-reveal");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("in-view"); }),
      { threshold: 0.1 }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return null;
}