"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js App Error Boundary Caught Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2 tracking-wide">Application Error Detected</h2>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          We encountered an unexpected runtime issue. Please try resetting or refreshing the page.
        </p>
        <button
          onClick={() => reset()}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
