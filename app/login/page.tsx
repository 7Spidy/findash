"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import RainCanvas from "@/components/RainCanvas";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Incorrect password. Try again.");
        setPassword("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 relative">
      <RainCanvas />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="heading text-4xl font-bold text-gray-800 tracking-tight">
            Fin<span className="text-sage-500">Dash</span>
          </span>
          <p className="text-gray-400 mt-2 text-sm">Your personal financial dashboard</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h1 className="heading text-xl font-semibold text-gray-800 mb-6 text-center">
            Sign in to continue
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                ref={inputRef}
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter dashboard password"
                className="w-full px-4 py-3 rounded-xl border border-white/60 bg-white/50
                           backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-sage-300
                           text-gray-800 placeholder:text-gray-300 text-sm"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-rose-500 text-sm text-center font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 px-6 rounded-xl font-semibold text-sm text-white
                         bg-gradient-to-r from-sage-500 to-sage-600
                         hover:from-sage-600 hover:to-sage-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200 shadow-sm hover:shadow-md
                         focus:outline-none focus:ring-2 focus:ring-sage-300"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">
          FinDash · Personal use only
        </p>
      </div>
    </div>
  );
}
