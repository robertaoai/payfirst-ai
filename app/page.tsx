"use client";

import { useEffect, useState } from "react";
import { WebGPUWidget } from "./components/WebGPUWidget";

export default function LandingPage() {
  const [sessionId] = useState(() =>
    typeof window !== "undefined"
      ? crypto.randomUUID()
      : "server"
  );
  const [visitLogged, setVisitLogged] = useState(false);
  const [intentLogging, setIntentLogging] = useState(false);
  const [email, setEmail] = useState("");
  const [checkoutError, setCheckoutError] = useState("");

  // Log page visit on mount
  useEffect(() => {
    if (visitLogged) return;

    async function logVisit() {
      try {
        // Detect WebGPU
        let webgpuAvailable = false;
        let vramGb = 0;

        if ("gpu" in navigator) {
          try {
            const gpu = (navigator as any).gpu;
            const adapter = await gpu.requestAdapter();
            if (adapter) {
              webgpuAvailable = true;
              // Try to get VRAM info from adapter limits
              const info = adapter.limits;
              // maxBufferSize gives a rough VRAM estimate
              const maxBuffer = info?.maxBufferSize ?? 0;
              if (maxBuffer > 0) {
                vramGb = Math.round((maxBuffer / (1024 * 1024 * 1024)) * 10) / 10;
              }
            }
          } catch {
            // WebGPU detection failed silently
          }
        }

        await fetch("/api/track/visit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            referrer: document.referrer || null,
            webgpu_available: webgpuAvailable,
            vram_gb: vramGb,
          }),
        });
        setVisitLogged(true);
      } catch {
        // Silent fail
      }
    }

    logVisit();
  }, [sessionId, visitLogged]);

  // Handle Buy click
  async function handleBuyClick(e: React.FormEvent) {
    e.preventDefault();
    if (intentLogging) return;
    setIntentLogging(true);
    setCheckoutError("");

    try {
      // Log purchase intent
      await fetch("/api/track/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          price_cents: 2900,
          cta_label: "Get Private AI — $29",
          email: email,
        }),
      });

      // Redirect to Stripe Checkout
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, email }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (res.status === 503) {
        setCheckoutError("Payment system is being set up. Please try again shortly.");
        setIntentLogging(false);
      } else if (data.error === "ALREADY_OWNED") {
        setCheckoutError("You already own lifetime access! Please check your inbox for the magic link or sign in at the top right.");
        setIntentLogging(false);
      } else {
        console.error("No checkout URL returned:", data.error);
        setCheckoutError(data.error || "Something went wrong. Please try again.");
        setIntentLogging(false);
      }
    } catch (err) {
      console.error("Buy click failed:", err);
      setCheckoutError("Network error. Please try again.");
      setIntentLogging(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0a0a1a 0%, #111133 40%, #0a0a1a 100%)",
        color: "#e8e8ff",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow effect */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "600px",
          background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "4rem 1.5rem", position: "relative" }}>
        {/* Logo / brand */}
        <div style={{ marginBottom: "3rem", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "6px 14px",
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: "999px",
              fontSize: "0.8rem",
              color: "#a5b4fc",
              fontWeight: 500,
            }}
          >
            🔒 100% On-Device · Zero Cloud Upload
          </div>
        </div>

        {/* Hero */}
        <h1
          style={{
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            textAlign: "center",
            margin: "0 0 1.5rem 0",
            background: "linear-gradient(135deg, #e0e7ff 0%, #a78bfa 50%, #60a5fa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Summarize confidential documents without uploading them anywhere.
        </h1>

        {/* Pain point */}
        <p
          style={{
            fontSize: "1.125rem",
            lineHeight: 1.7,
            color: "#9999bb",
            textAlign: "center",
            maxWidth: "580px",
            margin: "0 auto 2rem",
          }}
        >
          ChatGPT, Claude, and Copilot require you to upload your files to their servers.
          If you handle NDAs, case files, or proprietary research — that&apos;s a non-starter.{" "}
          <strong style={{ color: "#c4b5fd" }}>payfirst-ai runs the AI entirely on your laptop.</strong>{" "}
          Your documents never leave your device.
        </p>

        {/* How it works */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
            marginBottom: "2.5rem",
          }}
        >
          {[
            { icon: "📄", title: "Drop your file", desc: "PDF or text — parsed right in your browser" },
            { icon: "⚡", title: "AI runs locally", desc: "WebGPU-powered LLM on your GPU, zero server calls" },
            { icon: "📋", title: "Copy your summary", desc: "Done in seconds. Nothing uploaded. Ever." },
          ].map((step, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "12px",
                padding: "1.25rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{step.icon}</div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>{step.title}</div>
              <div style={{ fontSize: "0.8rem", color: "#7777aa" }}>{step.desc}</div>
            </div>
          ))}
        </div>

        {/* WebGPU Widget */}
        <WebGPUWidget />

        {/* Price + CTA */}
        <div style={{ textAlign: "center", margin: "2.5rem 0" }}>
          <div style={{ marginBottom: "1rem" }}>
            <span
              style={{
                fontSize: "3rem",
                fontWeight: 800,
                background: "linear-gradient(135deg, #34d399, #60a5fa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              $29
            </span>
            <span style={{ color: "#666", fontSize: "1rem", marginLeft: "0.5rem" }}>one-time</span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#7777aa", marginBottom: "1.25rem" }}>
            Lifetime access · No subscription · No data collection
          </p>
          
          <form 
            onSubmit={handleBuyClick} 
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", maxWidth: "400px", margin: "0 auto" }}
          >
            <input
              type="email"
              required
              placeholder="Enter your email to buy"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: "0.85rem 1.25rem",
                fontSize: "1rem",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(0,0,0,0.3)",
                color: "white",
                width: "100%",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "#6366f1"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.15)"}
            />
            
            {checkoutError && (
              <div style={{ color: "#ef4444", fontSize: "0.85rem", background: "rgba(239,68,68,0.1)", padding: "0.5rem", borderRadius: "8px", width: "100%" }}>
                {checkoutError}
              </div>
            )}

            <button
              type="submit"
              disabled={intentLogging}
              style={{
                width: "100%",
                padding: "1rem 2rem",
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#fff",
                background: intentLogging
                  ? "#555"
                  : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                border: "none",
                borderRadius: "12px",
                cursor: intentLogging ? "wait" : "pointer",
                boxShadow: intentLogging
                  ? "none"
                  : "0 4px 20px rgba(99,102,241,0.4), 0 0 60px rgba(99,102,241,0.15)",
                transition: "all 0.2s ease",
                letterSpacing: "0.01em",
              }}
            >
              {intentLogging ? "Redirecting to checkout…" : "Get Private AI"}
            </button>
          </form>
        </div>

        {/* Trust badges */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "2rem",
            flexWrap: "wrap",
            marginTop: "2rem",
            paddingTop: "2rem",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {[
            { icon: "🔐", text: "Data never leaves your device" },
            { icon: "💳", text: "Secure Stripe checkout" },
            { icon: "🖥️", text: "Works in Chrome, Edge, Brave" },
          ].map((badge, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "#7777aa" }}>
              <span>{badge.icon}</span>
              <span>{badge.text}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
