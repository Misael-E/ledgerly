"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/supabase";
import { DARK } from "@/app/lib/constants";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const t = DARK;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const supabase = createClient();

    if (isSignUp) {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) setError(err.message);
      else setMessage("Check your email for a confirmation link.");
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: "google" | "github") => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: t.bg,
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    }}>
      <div style={{
        width: 400, padding: 40, borderRadius: 16,
        background: t.card, border: `1px solid ${t.cardBorder}`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 700, color: t.violet, textAlign: "center" }}>
          Ledgerly
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 13, color: t.textTer, textAlign: "center" }}>
          Personal Finance Dashboard
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          <button onClick={() => handleOAuth("google")} style={{
            padding: "10px 16px", borderRadius: 8, border: `1px solid ${t.inputBorder}`,
            background: t.inputBg, color: t.text, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          <button onClick={() => handleOAuth("github")} style={{
            padding: "10px 16px", borderRadius: 8, border: `1px solid ${t.inputBorder}`,
            background: t.inputBg, color: t.text, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={t.text}><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            Continue with GitHub
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <div style={{ flex: 1, height: 1, background: t.cardBorder }} />
          <span style={{ fontSize: 12, color: t.textQuat }}>or</span>
          <div style={{ flex: 1, height: 1, background: t.cardBorder }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email" placeholder="Email" value={email} required
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.inputBorder}`,
              background: t.inputBg, color: t.text, fontSize: 14, outline: "none",
            }}
          />
          <input
            type="password" placeholder="Password" value={password} required minLength={6}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.inputBorder}`,
              background: t.inputBg, color: t.text, fontSize: 14, outline: "none",
            }}
          />
          <button type="submit" disabled={loading} style={{
            padding: "10px 16px", borderRadius: 8, border: "none",
            background: t.violet, color: "#fff", fontSize: 14, fontWeight: 600,
            cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "..." : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: t.red, textAlign: "center" }}>{error}</p>}
        {message && <p style={{ margin: "12px 0 0", fontSize: 13, color: t.green, textAlign: "center" }}>{message}</p>}

        <p style={{ margin: "16px 0 0", fontSize: 13, color: t.textTer, textAlign: "center" }}>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(""); setMessage(""); }} style={{
            background: "none", border: "none", color: t.violet, fontSize: 13,
            cursor: "pointer", textDecoration: "underline",
          }}>
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}
