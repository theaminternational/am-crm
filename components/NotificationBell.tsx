"use client";

import { useEffect, useState, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Bell, CheckCircle2, MessageSquare, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

export default function NotificationBell() {
  const { crmUser } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!crmUser?.uid) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", crmUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const nowMs = Date.now();
      const items = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((i: any) => {
          // Always show unread
          if (!i.read) return true;
          // Hide read notifications older than 3 days
          if (!i.createdAt) return true;
          const daysOld = (nowMs - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysOld <= 3;
        });

      // Sort client-side to avoid needing a composite index in Firestore
      items.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setNotifications(items.slice(0, 50));
      setUnreadCount(items.filter((i: any) => !i.read).length);
    });

    return () => unsub();
  }, [crmUser?.uid]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleNotificationClick = async (notif: any) => {
    setOpen(false);
    if (!notif.read) {
      try {
        await updateDoc(doc(db, "notifications", notif.id), { read: true });
      } catch (err) {
        console.error("Failed to mark notification read", err);
      }
    }
    if (notif.link) {
      let finalLink = notif.link;
      if (notif.type === "new-message" && !finalLink.includes("tab=chat")) {
        finalLink += finalLink.includes("?") ? "&tab=chat" : "?tab=chat";
      }
      router.push(finalLink);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    try {
      await Promise.all(
        unread.map((n) => updateDoc(doc(db, "notifications", n.id), { read: true }))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "task-assigned": return <Rocket className="w-4 h-4 text-amber-500" />;
      case "new-message": return <MessageSquare className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setOpen(!open)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-[#C9A84C] hover:bg-white/10 hover:text-white transition-all shadow-sm"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center shadow-md ring-1 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </div>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-[calc(100%+20px)] top-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-[100]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-sm text-[#0D1B3E]">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto no-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs font-semibold">You&apos;re all caught up!</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`text-left p-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors flex gap-3 relative ${!notif.read ? "bg-blue-50/30" : "opacity-75"}`}
                    >
                      {!notif.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}
                      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!notif.read ? "bg-white shadow-sm border border-slate-100" : "bg-slate-100"}`}>
                        {getIcon(notif.type)}
                      </div>
                      <div>
                        <p className={`text-xs ${!notif.read ? "font-bold text-slate-900" : "font-semibold text-slate-600"}`}>
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-wider">
                          {new Date(notif.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
