"use client";

import Link from 'next/link';
import NotificationBell from './NotificationBell';
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types";


interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
  icon: React.ReactNode;
  section?: string;
}

const I = {
  dashboard: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  leads: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  clients: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  projects: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  proposals: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  tasks: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  calendar: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  invoice: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  revenue: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  team: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/><path d="M12 14c-7 0-7 3-7 3v2h14v-2s0-3-7-3z"/></svg>,
  settings: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  logout: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  contacts: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
};

const NAV: NavItem[] = [
  { href: "/dashboard",  label: "Dashboard",  roles: ["admin"], icon: I.dashboard,  section: "main" },
  { href: "/leads",      label: "Leads",      roles: ["admin"],            icon: I.leads,      section: "main" },
  { href: "/proposals",  label: "Proposals",  roles: ["admin"],            icon: I.proposals,  section: "main" },
  { href: "/clients",    label: "Clients",    roles: ["admin"], icon: I.clients,    section: "main" },
  { href: "/projects",   label: "Projects",   roles: ["admin","lead"], icon: I.projects,   section: "main" },
  { href: "/tasks",      label: "Tasks",      roles: ["admin","lead","employee"], icon: I.tasks,      section: "main" },
  { href: "/contacts",   label: "Contacts",   roles: ["admin"],                   icon: I.contacts,   section: "main" },
  { href: "/calendar",   label: "Calendar",   roles: ["admin","lead","employee"], icon: I.calendar,   section: "main" },
  // Finance — ADMIN ONLY
  { href: "/invoice",    label: "Invoices",   roles: ["admin"],                                         icon: I.invoice,    section: "finance" },
  { href: "/revenue",    label: "Revenue",    roles: ["admin"],                                         icon: I.revenue,    section: "finance" },
  // Manage
  { href: "/team",       label: "Team",       roles: ["admin"],                               icon: I.team,       section: "manage" },
  { href: "/settings",   label: "Settings",   roles: ["admin"],                                         icon: I.settings,   section: "manage" },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const roleColors: Partial<Record<UserRole, string>> = {
  admin:     "#C9A84C",
  lead:      "#60a5fa",
  employee:  "#a78bfa",
};

export default function Sidebar() {
  const { crmUser, signOut } = useAuth();
  const pathname = usePathname();
  const role = crmUser?.role ?? "employee";
  const visible = NAV.filter((item) => item.roles.includes(role));

  const mainItems    = visible.filter((i) => i.section === "main");
  const financeItems = visible.filter((i) => i.section === "finance");
  const manageItems  = visible.filter((i) => i.section === "manage");

  const PANEL_ROUTES = ["/clients", "/projects"];

  function NavLink({ item }: { item: NavItem }) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const hasPanel = PANEL_ROUTES.includes(item.href);
    return (
      <Link 
        href={item.href} 
        prefetch={true}
        onClick={() => {
          if (hasPanel && typeof window !== "undefined") {
            window.dispatchEvent(new Event(`${item.href.slice(1)}:open-panel`));
          }
        }}
        className={`sidebar-link${isActive ? " active" : ""}`}
      >
        {item.icon}
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <div className="h-screen w-[220px] flex-shrink-0 flex flex-col" style={{ background: "var(--navy)", borderRight: "1px solid rgba(201,168,76,0.1)" }}>
      {/* Logo */}
      <div className="px-4 py-5 border-b flex items-center justify-between" style={{ borderColor: "rgba(201,168,76,0.1)" }}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold flex-shrink-0" style={{ background: "rgba(197,168,90,0.08)", border: "1px solid rgba(197,168,90,0.3)", color: "var(--gold)", fontFamily: "var(--font-outfit)", fontSize: "12px", letterSpacing: "0px" }}>A&M</div>
          <div className="overflow-hidden">
            <p className="text-white font-semibold text-[13px] leading-tight truncate">A&M CRM</p>
            <p className="text-[9px] leading-tight truncate" style={{ color: "var(--gold-light)", opacity: 0.8 }}>The A&M Internationals</p>
          </div>
        </div>
        <NotificationBell />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {mainItems.map((item) => <NavLink key={item.href} item={item} />)}

        {financeItems.length > 0 && (
          <>
            <div className="pt-3 pb-1 px-2">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(197,168,90,0.4)" }}>Finance</p>
            </div>
            {financeItems.map((item) => <NavLink key={item.href} item={item} />)}
          </>
        )}

        {manageItems.length > 0 && (
          <>
            <div className="pt-3 pb-1 px-2">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(201,168,76,0.4)" }}>Manage</p>
            </div>
            {manageItems.map((item) => <NavLink key={item.href} item={item} />)}
          </>
        )}
      </nav>

      {/* User */}
      {crmUser && (
        <div className="px-3 py-4 border-t" style={{ borderColor: "rgba(201,168,76,0.1)" }}>
          <div className="flex items-center gap-2 px-2 py-2 rounded-xl mb-2" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#0D1B3E", border: `2px solid ${roleColors[crmUser.role] || "#94a3b8"}`, color: roleColors[crmUser.role] || "#94a3b8" }}>
              {getInitials(crmUser.name)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-white text-xs font-medium truncate">{crmUser.name}</p>
              <p className="font-mono tracking-wider text-[10px] uppercase" style={{ color: "#C9A84C" }}>{crmUser.role}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="sidebar-link w-full text-left"
            style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            {I.logout}<span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
