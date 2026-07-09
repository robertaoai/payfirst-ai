"use client";

import { useEffect, useState } from "react";

type GPUStatus = "detecting" | "supported" | "not-supported";

export function WebGPUWidget() {
  const [status, setStatus] = useState<GPUStatus>("detecting");
  const [gpuName, setGpuName] = useState<string>("");
  const [vramEstimate, setVramEstimate] = useState<number>(0);

  useEffect(() => {
    async function detect() {
      if (!("gpu" in navigator)) {
        setStatus("not-supported");
        return;
      }

      try {
        const gpu = (navigator as any).gpu;
        const adapter = await gpu.requestAdapter();
        if (!adapter) {
          setStatus("not-supported");
          return;
        }

        setStatus("supported");

        // Try to get GPU info
        try {
          const info = await adapter.requestAdapterInfo();
          if (info?.description) {
            setGpuName(info.description);
          } else if (info?.device) {
            setGpuName(info.device);
          } else if (info?.vendor) {
            setGpuName(info.vendor);
          }
        } catch {
          // Adapter info not available
        }

        // Estimate VRAM from maxBufferSize
        const limits = adapter.limits;
        if (limits?.maxBufferSize) {
          const gb = Math.round((limits.maxBufferSize / (1024 * 1024 * 1024)) * 10) / 10;
          setVramEstimate(gb);
        }
      } catch {
        setStatus("not-supported");
      }
    }

    detect();
  }, []);

  const isSupported = status === "supported";
  const isDetecting = status === "detecting";

  return (
    <div
      style={{
        background: isSupported
          ? "rgba(52,211,153,0.06)"
          : isDetecting
          ? "rgba(255,255,255,0.03)"
          : "rgba(239,68,68,0.06)",
        border: `1px solid ${
          isSupported
            ? "rgba(52,211,153,0.2)"
            : isDetecting
            ? "rgba(255,255,255,0.06)"
            : "rgba(239,68,68,0.2)"
        }`,
        borderRadius: "12px",
        padding: "1rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        fontSize: "0.85rem",
      }}
    >
      {/* Status indicator */}
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: isSupported ? "#34d399" : isDetecting ? "#fbbf24" : "#ef4444",
          boxShadow: isSupported
            ? "0 0 8px rgba(52,211,153,0.5)"
            : isDetecting
            ? "0 0 8px rgba(251,191,36,0.5)"
            : "0 0 8px rgba(239,68,68,0.5)",
          flexShrink: 0,
          animation: isDetecting ? "pulse 1.5s infinite" : "none",
        }}
      />

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: isSupported ? "#34d399" : isDetecting ? "#fbbf24" : "#ef4444" }}>
          {isDetecting
            ? "Detecting your GPU…"
            : isSupported
            ? "✓ WebGPU Supported — Ready for on-device AI"
            : "✗ WebGPU Not Supported"}
        </div>
        {isSupported && (gpuName || vramEstimate > 0) && (
          <div style={{ color: "#7777aa", fontSize: "0.78rem", marginTop: "0.2rem" }}>
            {gpuName && <span>{gpuName}</span>}
            {gpuName && vramEstimate > 0 && <span> · </span>}
            {vramEstimate > 0 && <span>~{vramEstimate} GB available</span>}
          </div>
        )}
        {!isSupported && !isDetecting && (
          <div style={{ color: "#888", fontSize: "0.78rem", marginTop: "0.2rem" }}>
            Try Chrome, Edge, or Brave on a device with a modern GPU. The summarizer will still work — it just needs WebGPU.
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
