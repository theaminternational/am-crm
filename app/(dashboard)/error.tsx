"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard Error Boundary:", error);
  }, [error]);

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full crm-card text-center p-8">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Dashboard Issue Detected</h2>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          {error.message || "An unexpected error occurred while loading this section."}
        </p>
        <button
          onClick={() => reset()}
          className="btn-primary w-full py-3"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
