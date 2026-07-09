"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/confirm`,
      },
    });

    if (error) {
      setMessage("Error: " + error.message);
    } else {
      setMessage("Check your email for the magic link!");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a] text-neutral-200">
      <form onSubmit={handleLogin} className="bg-neutral-900 p-8 rounded-xl shadow-lg w-full max-w-sm space-y-4 border border-white/5">
        <h2 className="text-2xl font-bold text-white text-center">Login to payfirst-ai</h2>
        <p className="text-sm text-neutral-400 text-center">Enter your email to receive a magic link.</p>
        
        <div>
          <input
            type="email"
            placeholder="buyer@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 bg-black border border-white/10 rounded-md focus:outline-none focus:border-emerald-500 text-white"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-md font-medium transition-colors"
        >
          {loading ? "Sending..." : "Send Magic Link"}
        </button>

        {message && (
          <div className="mt-4 p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
