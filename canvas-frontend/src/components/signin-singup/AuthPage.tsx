import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

type AuthMode = "signin" | "signup";

interface Props {
  mode: AuthMode;
}

export default function AuthPage({ mode }: Props) {
  const navigate = useNavigate();
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);

      if (isSignup) {
        const res = await api.post("/home/signup", { name, email, password });
        const { verificationToken } = res.data;

        sessionStorage.clear();
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
      alert(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <div className="hidden md:flex w-1/2 bg-gradient-to-br from-indigo-50 to-purple-50 items-center justify-center p-12 relative">
        <div className="max-w-md text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">projectCanva</h1>
          <p className="text-gray-600 mb-8">Organize Your Digital Canvas.</p>
          <div className="relative w-64 h-48 mx-auto">
            <div className="absolute bottom-0 left-0 w-16 h-32 bg-indigo-400 rounded-md shadow-lg"></div>
            <div className="absolute bottom-0 left-14 w-16 h-36 bg-purple-400 rounded-md shadow-lg"></div>
            <div className="absolute bottom-0 left-28 w-16 h-28 bg-pink-400 rounded-md shadow-lg"></div>
            <div className="absolute bottom-0 left-42 w-16 h-34 bg-blue-400 rounded-md shadow-lg"></div>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-px bg-gray-200" />
      </div>

      <div className="flex w-full md:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-semibold text-gray-800 mb-2">
            {isSignup ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-gray-500 mb-8">
            {isSignup ? "Start managing your books today." : "Sign in to continue to projectCanva."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignup && (
              <input
                type="text"
                placeholder="Full Name"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            <input
              type="email"
              placeholder="Email"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg text-white font-medium transition ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {loading ? "Please wait..." : isSignup ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {isSignup ? (
              <>Already have an account?{" "}
                <button onClick={() => navigate("/signin")} className="text-indigo-600 font-medium hover:underline">Sign in</button>
              </>
            ) : (
              <>Don't have an account?{" "}
                <button onClick={() => navigate("/signup")} className="text-indigo-600 font-medium hover:underline">Sign up</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}