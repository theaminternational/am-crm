"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#06101f] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)" }}>
        <span style={{ color: "#C9A84C", fontSize: "20px", fontWeight: "bold" }}>404</span>
      </div>
      <h1 className="text-3xl font-bold mb-2">Page Not Found</h1>
      <p className="text-sm text-gray-400 mb-8 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="px-6 py-3 rounded-xl font-bold text-sm bg-[#C9A84C] text-[#0D1B3E] transition-all">
        Back to Dashboard
      </Link>
    </div>
  );
}
