"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/sidebar";
import { PipelineService } from "@/lib/pipeline-service";


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { crmUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !crmUser) {
      router.replace("/login");
    } else if (crmUser) {
      if (crmUser.requiresPasswordChange) {
        router.replace("/setup-password");
        return;
      }
      PipelineService.initGlobalPipelineListener();
    }

    const handleWheel = (e: WheelEvent) => {
      if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === "number") {
        e.preventDefault();
        document.activeElement.blur();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement && 
        document.activeElement.type === "number" &&
        (e.key === "ArrowUp" || e.key === "ArrowDown")
      ) {
        e.preventDefault();
      }
    };
    
    // Prevent accidental scroll-wheel changes on number inputs globally
    // passive: false is REQUIRED to use preventDefault()
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [crmUser, loading, router]);

  // Full navy loading screen — no white flash
  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{
          background: "var(--navy)",
        }}
      >
        {/* A&M logo */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2"
          style={{
            background: "rgba(197, 168, 90, 0.05)",
            border: "1px solid rgba(197, 168, 90, 0.3)",
          }}
        >
          <span
            style={{
              color: "var(--gold)",
              fontFamily: "var(--font-outfit)",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "0px",
            }}
          >
            A&M
          </span>
        </div>

        {/* Spinner */}
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{
            borderColor: "rgba(197, 168, 90, 0.2)",
            borderTopColor: "var(--gold)",
          }}
        />

        {/* Text */}
        <p
          style={{ color: "var(--gold-dark)" }}
        >
          Loading Dashboard...
        </p>
      </div>
    );
  }

  // Not logged in — show nothing while redirect happens
  if (!crmUser) {
    return (
      <div
        className="min-h-screen"
        style={{
          background: "var(--navy)",
        }}
      />
    );
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#F4F5F7" }}
    >
      <Sidebar />
      <main className="flex-1 overflow-y-auto flex flex-col bg-[#F4F5F7] relative">
        {children}
      </main>
    </div>
  );
}
