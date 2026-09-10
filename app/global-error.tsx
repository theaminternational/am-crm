"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js Root Global Error Caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#06101f", color: "#ffffff", fontFamily: "sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ maxWidth: "420px", width: "100%", margin: "0 auto", textAlign: "center", background: "rgba(255,255,255,0.05)", padding: "32px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h2 style={{ color: "#ffffff", fontSize: "20px", marginBottom: "12px" }}>Application Error Detected</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "24px" }}>
              A critical runtime error occurred. Please click below to reset the application.
            </p>
            <button
              onClick={() => reset()}
              style={{ width: "100%", padding: "12px 20px", borderRadius: "10px", background: "#C9A84C", color: "#0D1B3E", border: "none", fontWeight: "bold", cursor: "pointer" }}
            >
              Reset & Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
