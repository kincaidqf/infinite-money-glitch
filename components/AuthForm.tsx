"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Tab = "signin" | "signup";

export default function AuthForm() {
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-form">
      <div className="auth-tabs">
        <button
          className={`auth-tab ${tab === "signin" ? "auth-tab--active" : ""}`}
          onClick={() => { setTab("signin"); setError(null); }}
        >
          Sign In
        </button>
        <button
          className={`auth-tab ${tab === "signup" ? "auth-tab--active" : ""}`}
          onClick={() => { setTab("signup"); setError(null); }}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-fields">
        <label className="auth-label">
          Email
          <input
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>

        <label className="auth-label">
          Password
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={tab === "signup" ? "new-password" : "current-password"}
            placeholder="••••••••"
            minLength={6}
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </div>
  );
}
