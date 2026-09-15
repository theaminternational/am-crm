"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Building2, Calendar, AlertTriangle, Clock, Rocket } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const SERVICE_LABELS: Record<string, string> = {
  "digital-marketing": "Digital",
  "ui-ux": "UI/UX",
  "web-development": "Web Dev",
  "seo": "SEO",
  "social-media": "Social",
  "branding": "Branding",
  "other": "Other",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PIE_COLORS = ["#0D1B3E","#C9A84C","#3b82f6","#22c55e","#f59e0b","#ef4444","#8b5cf6"];

const STAGE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  meeting:  { color: "#c2410c", bg: "#fff7ed", label: "Meeting" },
  proposal: { color: "#1d4ed8", bg: "#eff6ff", label: "Proposal" },
  won:      { color: "#15803d", bg: "#f0fdf4", label: "Won" },
  lost:     { color: "#b91c1c", bg: "#fef2f2", label: "Lost" },
};

function StatCard({ label, value, sub, color, icon, href }: { label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="stat-card group block relative transition-shadow hover:shadow-md cursor-pointer">
      <div className="absolute top-0 left-0 w-full h-1 rounded-t-xl" style={{ background: color }} />
      <div className="flex items-start justify-between mt-1">
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: "#9ca3af" }}>{label}</p>
          <p className="text-3xl font-bold leading-tight" style={{ color: "#0D1B3E" }}>{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>{sub}</p>}
        </div>
        <div className="text-2xl opacity-20 group-hover:opacity-40 transition-opacity">{icon}</div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { crmUser } = useAuth();
  const isAdmin = crmUser?.role === "admin";

  const [leads, setLeads]     = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks]     = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [manualRev, setManualRev] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [lSnap, cSnap, pSnap, tSnap] = await Promise.all([
          getDocs(query(collection(db, "leads"), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, "clients"), where("status", "==", "active"))),
          getDocs(collection(db, "projects")),
          getDocs(query(collection(db, "tasks"), where("done", "==", false))),
        ]);
        setLeads(lSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setClients(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setProjects(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTasks(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        if (isAdmin) {
          const [iSnap, mSnap] = await Promise.all([
            getDocs(collection(db, "invoices")),
            getDocs(collection(db, "manual_revenue")),
          ]);
          setInvoices(iSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setManualRev(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    fetchAll();
  }, [isAdmin]);

  const [triggering, setTriggering] = useState(false);

  async function triggerReminders() {
    setTriggering(true);
    try {
      const res = await fetch("/api/cron/reminders");
      const data = await res.json();
      if (data.success) {
        alert(`Success! Processed reminders. Alerts sent: ${data.emailsSent}`);
      } else {
        alert(`Error: ${data.error || "Failed to trigger"}`);
      }
    } catch (err) {
      alert("Network error triggering reminders");
    } finally {
      setTriggering(false);
    }
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = crmUser?.name?.split(" ")[0] ?? "there";

  const wonLeads  = leads.filter(l => l.stage === "won").length;
  const lostLeads = leads.filter(l => l.stage === "lost").length;
  const winRate   = leads.length > 0 ? Math.round((wonLeads / leads.length) * 100) : 0;

  // Monthly leads data
  const year = new Date().getFullYear();
  const monthlyLeads = MONTHS.map((month, idx) => ({
    month,
    Leads: leads.filter(l => new Date(l.createdAt).getMonth() === idx && new Date(l.createdAt).getFullYear() === year).length,
    Won: leads.filter(l => l.stage === "won" && new Date(l.createdAt).getMonth() === idx && new Date(l.createdAt).getFullYear() === year).length,
  }));

  // Service breakdown
  const svcMap: Record<string, number> = {};
  leads.forEach(l => { svcMap[l.service] = (svcMap[l.service] || 0) + 1; });
  const serviceData = Object.entries(svcMap).map(([name, value]) => ({ name: SERVICE_LABELS[name] || name, value }));

  // Admin revenue calculations mirroring Revenue Page
  const invoiceRevenue = invoices.reduce((s, i) => {
    const paid = i.paidAmount !== undefined ? Number(i.paidAmount) : (i.status === "paid" ? Number(i.total) : 0);
    return s + paid;
  }, 0);
  
  const completedProjectsValue = projects
    .filter(p => p.status === "completed")
    .reduce((s, p) => {
      const paidForProject = invoices
        .filter(inv => inv.projectId === p.id)
        .reduce((sum, inv) => {
          const paid = inv.paidAmount !== undefined ? Number(inv.paidAmount) : (inv.status === "paid" ? Number(inv.total) : 0);
          return sum + paid;
        }, 0);
      return s + Math.max(0, (Number(p.budget) || 0) - paidForProject);
    }, 0);

  const manualRevenueTotal = manualRev.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const totalRevenue = invoiceRevenue + completedProjectsValue + manualRevenueTotal;
  const pendingRevenue = invoices.reduce((s, i) => {
    const paid = i.paidAmount !== undefined ? Number(i.paidAmount) : (i.status === "paid" ? Number(i.total) : 0);
    return s + Math.max(0, (Number(i.total) || 0) - paid);
  }, 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "white", border: "1px solid #e8e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <p style={{ fontWeight: 700, color: "#0D1B3E", marginBottom: 4 }}>{label}</p>
        {payload.map((p: any) => <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>{p.name}: <strong>{p.value}</strong></p>)}
      </div>
    );
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#C9A84C" }}>{greeting},</p>
          <h1 className="page-title flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            {firstName} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
            Here&apos;s what&apos;s happening with your team today.
          </p>
          <div className="flex items-center gap-3 mt-4">
            {isAdmin && (
              <>
                <Link href="/revenue" className="btn-secondary px-4 py-2 text-xs" style={{ borderColor: "#22c55e", color: "#22c55e" }}>
                  <span className="text-sm">+</span> Add Revenue
                </Link>
                <Link href="/revenue" className="btn-primary px-4 py-2 text-xs">
                  <span className="text-sm">+</span> Add Expense
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium" style={{ color: "#9ca3af" }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <div className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "#d1fae5", color: "#065f46" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            CRM Active
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Leads"     value={leads.length}    sub={`${wonLeads} won · ${lostLeads} lost`} color="var(--navy)" icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>} href="/leads" />
        <StatCard label="Active Clients"  value={clients.length}  sub="Ongoing relationships"                color="var(--gold)" icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} href="/clients" />
        <StatCard label="Open Projects"   value={projects.filter(p => p.status !== "completed" && (!p.clientId || clients.some(c => c.id === p.clientId))).length} sub="In progress" color="#475569" icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>} href="/projects" />
        <StatCard label="Pending Tasks"   value={tasks.filter(t => !t.clientId || clients.some(c => c.id === t.clientId)).length}    sub="Across all team"                      color="#1F2937" icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>} href="/tasks" />
      </div>

      {/* COMMAND CENTER (ACTIONABLE ALERTS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Overdue & Priority Tasks */}
        <div className="crm-card border-l-4 border-l-red-500">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Attention Required
          </h2>
          <div className="space-y-3">
            {tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length > 0 ? (
              tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).slice(0, 3).map(t => (
                <Link href={t.relatedType === 'project' && t.relatedTo ? `/projects/${t.relatedTo}` : `/tasks`} key={t.id} className="flex justify-between items-center text-xs p-2 bg-red-50 hover:bg-red-100 transition-colors rounded-lg cursor-pointer">
                  <span className="font-semibold text-red-900 truncate pr-2">{t.title}</span>
                  <span className="text-red-700 whitespace-nowrap">Overdue</span>
                </Link>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No overdue tasks.</p>
            )}
          </div>
        </div>

        {/* Leads Needing Follow Up */}
        <div className="crm-card border-l-4 border-l-amber-500">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" /> Lead Follow-ups
          </h2>
          <div className="space-y-3">
            {leads.filter(l => l.active !== false && l.followUpDate && new Date(l.followUpDate) <= new Date(Date.now() + 86400000)).length > 0 ? (
              leads.filter(l => l.active !== false && l.followUpDate && new Date(l.followUpDate) <= new Date(Date.now() + 86400000)).slice(0, 3).map(l => (
                <Link href={`/leads?id=${l.id}`} key={l.id} className="flex justify-between items-center text-xs p-2 bg-amber-50 hover:bg-amber-100 transition-colors rounded-lg cursor-pointer">
                  <span className="font-semibold text-amber-900 truncate pr-2">{l.name}</span>
                  <span className="text-amber-700 whitespace-nowrap">{new Date(l.followUpDate).toLocaleDateString()}</span>
                </Link>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No immediate follow-ups.</p>
            )}
          </div>
        </div>

        {/* Projects at Risk */}
        <div className="crm-card border-l-4 border-l-blue-500">
          <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Rocket className="w-4 h-4 text-blue-500" /> Upcoming Deadlines
          </h2>
          <div className="space-y-3">
            {projects.filter(p => p.status !== "completed" && p.deadline && new Date(p.deadline) <= new Date(Date.now() + 7 * 86400000)).length > 0 ? (
              projects.filter(p => p.status !== "completed" && p.deadline && new Date(p.deadline) <= new Date(Date.now() + 7 * 86400000)).slice(0, 3).map(p => (
                <Link href={`/projects/${p.id}`} key={p.id} className="flex justify-between items-center text-xs p-2 bg-blue-50 hover:bg-blue-100 transition-colors rounded-lg cursor-pointer">
                  <span className="font-semibold text-blue-900 truncate pr-2">{p.title}</span>
                  <span className="text-blue-700 whitespace-nowrap">Due soon</span>
                </Link>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No projects at risk.</p>
            )}
          </div>
        </div>
      </div>

      {/* Admin Finance Row */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="stat-card" style={{ background: "var(--navy)" }}>
            <div className="absolute top-0 left-0 w-full h-1 rounded-t-xl" style={{ background: "#C9A84C" }} />
            <p className="text-xs font-semibold mt-1 mb-1" style={{ color: "rgba(201,168,76,0.7)" }}>Realized Revenue</p>
            <p className="text-3xl font-bold" style={{ color: "#C9A84C" }}>AED {totalRevenue.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>paid invoices + completed projects + manual</p>
          </div>
          <div className="stat-card" style={{ background: "var(--navy)" }}>
            <div className="absolute top-0 left-0 w-full h-1 rounded-t-xl" style={{ background: "#f59e0b" }} />
            <p className="text-xs font-semibold mt-1 mb-1" style={{ color: "rgba(245,158,11,0.8)" }}>Pending Revenue</p>
            <p className="text-3xl font-bold" style={{ color: "#f59e0b" }}>AED {pendingRevenue.toLocaleString()}</p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{invoices.filter(i => i.status !== "paid").length} unpaid invoices</p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Monthly Leads Chart */}
        <div className="crm-card lg:col-span-2">
          <h2 className="text-sm font-bold mb-1" style={{ color: "#0D1B3E" }}>Leads This Year</h2>
          <p className="text-xs mb-4" style={{ color: "#9ca3af" }}>Monthly lead generation & conversions</p>
          {loading ? (
            <div className="h-48 animate-pulse rounded-xl" style={{ background: "#f0f2f8" }} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyLeads} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Leads" stroke="#C9A84C" strokeWidth={2} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="Won"   stroke="#22c55e" strokeWidth={2} fill="url(#colorWon)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Win Rate + Pipeline */}
        <div className="crm-card">
          <h2 className="text-sm font-bold mb-4" style={{ color: "#0D1B3E" }}>Pipeline Overview</h2>
          {/* Win rate circle */}
          <div className="flex items-center gap-4 mb-5">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                <circle cx="32" cy="32" r="26" fill="none" stroke="#f0f0f5" strokeWidth="7" />
                <circle cx="32" cy="32" r="26" fill="none" stroke="#C9A84C" strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (1 - winRate / 100)}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold" style={{ color: "#0D1B3E" }}>{winRate}%</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: "#9ca3af" }}>Win Rate</p>
              <p className="text-lg font-bold" style={{ color: "#0D1B3E" }}>{wonLeads} Won</p>
              <p className="text-xs" style={{ color: "#9ca3af" }}>{lostLeads} lost</p>
            </div>
          </div>
          {/* Pipeline stages */}
          <div className="space-y-2">
            {Object.entries(STAGE_CONFIG).map(([key, cfg]) => {
              const count = leads.filter(l => l.stage === key).length;
              const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                    <span className="text-xs font-bold" style={{ color: "#374151" }}>{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "#f0f0f5" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cfg.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Service breakdown */}
        <div className="crm-card">
          <h2 className="text-sm font-bold mb-4" style={{ color: "#0D1B3E" }}>Leads by Service</h2>
          {serviceData.length === 0 ? (
            <div className="text-center py-8"><p className="text-xs" style={{ color: "#9ca3af" }}>No leads yet</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={serviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={3}>
                  {serviceData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Leads"]} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-1 mt-2">
            {serviceData.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span style={{ color: "#374151" }}>{s.name}</span>
                </div>
                <span className="font-semibold" style={{ color: "#0D1B3E" }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="crm-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: "#0D1B3E" }}>Recent Leads</h2>
            <a href="/leads" className="text-xs font-semibold" style={{ color: "#C9A84C" }}>View all →</a>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "#f0f2f8" }} />)}</div>
          ) : leads.slice(0, 5).length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs" style={{ color: "#9ca3af" }}>No leads yet</p>
              <a href="/leads" className="btn-primary mt-2 mx-auto" style={{ fontSize: 11, padding: "4px 12px" }}>+ Add Lead</a>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {leads.filter(l => l.active !== false).slice(0, 5).map((lead: any) => {
                const st = STAGE_CONFIG[lead.stage] ?? { color: "#7e22ce", bg: "#faf5ff", label: lead.stage || "Lead" };
                return (
                  <div key={lead.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-colors shadow-sm">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white" style={{ background: "var(--navy)" }}>
                      {lead.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: "var(--charcoal)" }}>{lead.name}</p>
                      <p className="text-xs truncate" style={{ color: "var(--slate)" }}>{lead.company}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md font-bold" style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Tasks */}
        <div className="crm-card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: "#0D1B3E" }}>Pending Tasks</h2>
            <a href="/tasks" className="text-xs font-semibold" style={{ color: "#C9A84C" }}>View all →</a>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "#f0f2f8" }} />)}</div>
          ) : tasks.filter(t => !t.clientId || clients.some(c => c.id === t.clientId)).length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs" style={{ color: "#9ca3af" }}>All tasks done! 🎉</p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {tasks.filter(t => !t.clientId || clients.some(c => c.id === t.clientId)).slice(0, 5).map((task: any) => {
                const pColors: Record<string, string> = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                return (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-colors shadow-sm">
                    <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: pColors[task.priority] ?? "#9ca3af" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: "var(--charcoal)" }}>{task.title}</p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1.5">
                        {task.clientName && (
                          <p className="text-xs flex items-center gap-1 truncate" style={{ color: "var(--slate)" }}>
                            <Building2 className="w-3.5 h-3.5" /> 
                            <span className="truncate">{task.clientName}</span>
                          </p>
                        )}
                        {task.dueDate && (
                          <p className="text-xs flex items-center gap-1 whitespace-nowrap" style={{ color: isOverdue ? "#ef4444" : "var(--slate)" }}>
                            <Calendar className="w-3.5 h-3.5" /> 
                            {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md font-bold flex-shrink-0" style={{ background: `${pColors[task.priority] ?? "#9ca3af"}15`, color: pColors[task.priority] ?? "#9ca3af" }}>
                      {task.priority}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
