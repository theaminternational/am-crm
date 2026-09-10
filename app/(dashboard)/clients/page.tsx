"use client";
import { X, Trash2 } from "lucide-react";


import { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Client, ServiceTag } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { PhoneInput } from "@/components/phone-input";
import { PipelineService } from "@/lib/pipeline-service";
import { useRouter, useSearchParams } from "next/navigation";
import CreateProjectModal from "@/components/CreateProjectModal";

const SERVICES: { key: ServiceTag; label: string; bg: string; text: string }[] = [
  { key: "digital-marketing", label: "Digital Marketing", bg: "#dbeafe", text: "#1e40af" },
  { key: "ui-ux",             label: "UI/UX Design",      bg: "#fef3c7", text: "#92400e" },
  { key: "web-development",   label: "Web Development",   bg: "#d1fae5", text: "#065f46" },
  { key: "seo",               label: "SEO",               bg: "#ede9fe", text: "#5b21b6" },
  { key: "social-media",      label: "Social Media",      bg: "#fce7f3", text: "#9d174d" },
  { key: "branding",          label: "Branding",          bg: "#ffedd5", text: "#9a3412" },
  { key: "technology-services", label: "Technology Services", bg: "#e0f2fe", text: "#0369a1" },
  { key: "oracle-epm",        label: "Oracle EPM",        bg: "#fef08a", text: "#854d0e" },
  { key: "other",             label: "Other",             bg: "#f3f4f6", text: "#374151" },
];

const CURRENCIES = [
  { code: "AED", label: "AED (Dirham)" },
  { code: "USD", label: "USD (Dollar)" },
  { code: "INR", label: "INR (Rupee)" },

];

const EMPTY_FORM = {
  name: "", company: "", email: "", phone: "",
  services: [] as ServiceTag[],
  status: "active" as "active" | "inactive",
  address: "", website: "", notes: "",
  currency: "AED",
  budget: "", due: "", paid: "", remaining: "",
};

function Initials({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["#0D1B3E", "#1a3070", "#C9A84C", "#9a7a2e", "#1d4ed8", "#15803d"];
  const bg = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0" style={{ background: bg }}>
      {initials}
    </div>
  );
}

export default function ClientsPage() {
  const { crmUser } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedClientForProject, setSelectedClientForProject] = useState<{id: string, name: string} | undefined>(undefined);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [openClientPanel, setOpenClientPanel] = useState(false);
  const [showHiddenClients, setShowHiddenClients] = useState(false);

  const canEdit = crmUser?.role === "admin";

  const searchParams = useSearchParams();

  useEffect(() => {
    function openFromSidebar() {
      setOpenClientPanel(true);
    }
    window.addEventListener("clients:open-panel", openFromSidebar);
    return () => window.removeEventListener("clients:open-panel", openFromSidebar);
  }, []);

  function selectClientFilter(filter: "all" | "active" | "inactive") {
    setStatusFilter(filter);
    if (filter === "inactive") {
      setShowHiddenClients(true);
    } else if (filter === "active") {
      setShowHiddenClients(false);
    }
    setOpenClientPanel(false);
  }

  useEffect(() => {
    const unsubClients = onSnapshot(query(collection(db, "clients"), orderBy("createdAt", "desc")), (snap) => {
      setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client)));
      setLoading(false);
    });
    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubTasks = onSnapshot(collection(db, "tasks"), (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubClients(); unsubProjects(); unsubTasks(); };
  }, []);

  if (crmUser && crmUser.role === "employee") {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-2xl font-black text-red-500 mb-2">Access Denied</h2>
        <p className="text-slate-500 mb-6">The clients directory is strictly restricted to administrators.</p>
        <button onClick={() => router.push("/")} className="px-6 py-2 bg-[#0D1B3E] text-white rounded-lg font-bold">Return to Dashboard</button>
      </div>
    );
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setForm({
      name: client.name, company: client.company, email: client.email,
      phone: client.phone ?? "", services: client.services ?? [],
      status: client.status, address: client.address ?? "",
      website: client.website ?? "", notes: client.notes ?? "",
      currency: client.currency ?? "AED",
      budget: client.budget?.toString() ?? "",
      due: client.due?.toString() ?? "",
      paid: client.paid?.toString() ?? "",
      remaining: client.remaining?.toString() ?? client.balance?.toString() ?? "",
    });
    setShowModal(true);
  }

  function toggleService(svc: ServiceTag) {
    setForm((f) => ({
      ...f,
      services: f.services.includes(svc)
        ? f.services.filter((s) => s !== svc)
        : [...f.services, svc],
    }));
  }


  async function handleSave() {
    if (!form.name || !form.company || !form.email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      alert("Please enter a valid email address.");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      
      const payload: any = { ...form };
      if (payload.budget) payload.budget = Number(payload.budget); else delete payload.budget;
      if (payload.due) payload.due = Number(payload.due); else delete payload.due;
      if (payload.paid) payload.paid = Number(payload.paid); else delete payload.paid;
      if (payload.remaining) payload.remaining = Number(payload.remaining); else delete payload.remaining;

      if (editing) {
        await updateDoc(doc(db, "clients", editing.id), payload);
        await PipelineService.syncClientDetails({ id: editing.id, ...payload } as any);
      } else {
        await addDoc(collection(db, "clients"), { ...payload, createdAt: now, active: true });
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function archiveClient(id: string) {
    if (!confirm("Are you sure? This will archive the client and unlink their active tasks/projects.")) return;
    try {
      const batch = writeBatch(db);
      
      // 1. Archive the client
      batch.update(doc(db, "clients", id), { active: false, status: "inactive", archivedAt: new Date().toISOString() });

      // 2. Cascade cleanup: Unlink active tasks
      const taskQ = query(collection(db, "tasks"), where("clientId", "==", id));
      const taskSnap = await getDocs(taskQ);
      taskSnap.forEach(t => {
        batch.update(doc(db, "tasks", t.id), { clientId: "", clientName: "Archived Client" });
      });

      // 3. Cascade cleanup: Archive projects
      const projQ = query(collection(db, "projects"), where("clientId", "==", id));
      const projSnap = await getDocs(projQ);
      projSnap.forEach(p => {
        batch.update(doc(db, "projects", p.id), { status: "on-hold", notes: `(Client Archived) ${p.data().notes || ""}` });
      });

      await batch.commit();
      console.log("Client and related items processed successfully.");
    } catch (error) {
      console.error("Error archiving client:", error);
      alert("Failed to archive client properly.");
    }
  }


  async function toggleLostStatus(client: Client) {
    if (client.active === false) {
      if (!confirm(`Recover ${client.name} back to Active clients?`)) return;
      await updateDoc(doc(db, "clients", client.id), { active: true, status: "active", archivedAt: null });
    } else {
      await archiveClient(client.id);
    }
  }

  async function deleteClient(id: string) {
    if (!confirm("PERMANENT DELETE: Are you sure you want to completely remove this client? This will also delete all their projects, tasks, invoices, proposals, and leads. This cannot be undone.")) return;
    try {
      await PipelineService.deleteClientAndRelations(id);
      console.log("Client and all associated data deleted permanently.");
    } catch (error) {
      console.error("Error deleting client:", error);
      alert("Failed to delete client completely.");
    }
  }

  const filtered = clients
    .filter(c => showHiddenClients ? c.active === false : c.active !== false)
    .filter((c) => statusFilter === "all" || c.status === statusFilter)
    .filter((c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => setOpenClientPanel(true)} className="flex items-center gap-2 group text-left">
            <h1 className="page-title flex items-center gap-3 mb-0">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Clients
            </h1>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2.5" className="mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
            {statusFilter === "all"
              ? `${clients.length} total clients`
              : statusFilter === "active"
                ? `${clients.filter((c) => c.active !== false).length} active clients`
                : `${clients.filter((c) => c.active === false).length} inactive clients`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canEdit && (
            <button 
              onClick={() => { setSelectedClientForProject(undefined); setShowProjectModal(true); }} 
              className="px-5 py-2.5 rounded-lg text-sm font-bold text-[#0D1B3E] transition-opacity hover:opacity-90 shadow-sm border border-[#e2e8f0] bg-white"
            >
              + New Project
            </button>
          )}
          <button 
            onClick={() => setShowHiddenClients(!showHiddenClients)}
            className="text-xs font-semibold px-4 py-2 rounded-lg border transition-all"
            style={{ 
              background: showHiddenClients ? "#0D1B3E" : "white", 
              color: showHiddenClients ? "white" : "#6b7280",
              borderColor: "#e5e7eb"
            }}
          >
            {showHiddenClients ? "View Active" : "View Archive"}
          </button>
          {canEdit && (
            <button onClick={openAdd} className="btn-primary">
              <span className="text-lg leading-none">+</span> Add Client
            </button>
          )}
        </div>
      </div>

      {/* Client filter panel */}
      {openClientPanel && (
        <div className="fixed inset-0 z-50" onClick={() => setOpenClientPanel(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(13, 27, 62, 0.35)", backdropFilter: "blur(2px)" }} />
          <div className="client-panel absolute left-0 top-0 h-full w-[280px] shadow-2xl flex flex-col" style={{ background: "linear-gradient(180deg, #0D1B3E 0%, #142450 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-6 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">Clients Filter</h2>
                <p className="text-[11px] mt-0.5" style={{ color: "#8b93ab" }}>Choose a category</p>
              </div>
              <button onClick={() => setOpenClientPanel(false)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-[#8b93ab] hover:text-white hover:bg-white/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
              {[
                { key: "all", label: "All Clients", dot: "#C9A84C", count: clients.length },
                { key: "active", label: "Active Clients", dot: "#22c55e", count: clients.filter((c) => c.active !== false).length },
                { key: "inactive", label: "Inactive Clients", dot: "#94a3b8", count: clients.filter((c) => c.active === false).length },
              ].map((item) => {
                const selected = statusFilter === item.key;
                return (
                  <button key={item.key} onClick={() => selectClientFilter(item.key as any)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all" style={{ background: selected ? "rgba(201, 168, 76, 0.12)" : "transparent", borderLeft: selected ? "3px solid #C9A84C" : "3px solid transparent", color: selected ? "#C9A84C" : "#c4cadb" }}>
                    <span className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.dot }} />
                      {item.label}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center" style={{ background: selected ? "rgba(201, 168, 76, 0.2)" : "rgba(255,255,255,0.08)", color: selected ? "#C9A84C" : "#8b93ab" }}>
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <input
          className="px-4 py-2 rounded-lg border text-sm outline-none transition-colors"
          style={{ borderColor: "#e5e7eb", width: 280 }}
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
          onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
        />
      </div>

      {/* Client List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "#f3f4f6" }} />)
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: "#9ca3af" }}>No clients found</p>
            {canEdit && (
              <button onClick={openAdd} className="mt-4 px-6 py-2 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all" style={{ background: "#0D1B3E" }}>
                Add New Client
              </button>
            )}
          </div>
        ) : (
          filtered.map((client) => {
            const clientProjects = projects.filter((p) => p.clientId === client.id);
            const clientTasks = tasks.filter((t) => t.clientId === client.id && !t.done);
            return (
              <div 
                key={client.id} 
                onClick={() => router.push(`/clients/${client.id}`)}
                className="bg-white rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-[#C9A84C]/30 transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[200px] relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-50 border border-slate-200 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors" style={{
                      background: client.status === "active" ? "#0D1B3E" : "#f1f5f9",
                      color: client.status === "active" ? "white" : "#64748b",
                    }}>
                      {client.status}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10 relative">
                      {canEdit && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(client);
                          }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:bg-slate-50 hover:text-[#0D1B3E] transition-all"
                          title="Edit Client"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteClient(client.id);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all"
                        title="Delete Client"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-end justify-between mt-auto">
                    <div className="flex flex-col gap-3">
                      <div>
                        <h3 className="text-xl font-black text-[#0D1B3E] tracking-tight line-clamp-1 mb-1 group-hover:text-[#C9A84C] transition-colors" style={{ fontFamily: "var(--font-playfair)" }}>
                          {client.company || client.name}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 line-clamp-1">
                          {client.name}
                        </p>
                      </div>
                      
                      {client.services && client.services.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {client.services.map((svc: string) => (
                            <span key={svc} className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-slate-50 text-slate-500 border border-slate-200">
                              {svc.replace(/-/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {canEdit && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClientForProject({ id: client.id, name: client.company || client.name });
                          setShowProjectModal(true);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[#0D1B3E] text-white hover:bg-slate-800 shadow-sm z-10 flex items-center gap-1.5"
                      >
                        <span>+ Project</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 overflow-y-auto max-h-[90vh]" style={{ background: "white" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "#0D1B3E", fontFamily: "var(--font-playfair)" }}>
                {editing ? "Edit Client" : "Add New Client"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl"><X className="inline-block w-4 h-4 shrink-0 mr-1" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" /></div>
                <div><label className="form-label">Company *</label><input className="form-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Corp" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="form-label">Email *</label><input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div>
                  <label className="form-label">Phone</label>
                  <PhoneInput value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} />
                </div>
              </div>
              <div><label className="form-label">Website</label><input className="form-input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." /></div>
              <div>
                <label className="form-label">Services</label>
                <div className="flex gap-2 mt-1">
                  {SERVICES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleService(s.key)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                      style={{
                        background: form.services.includes(s.key) ? s.bg : "white",
                        color: form.services.includes(s.key) ? s.text : "#6b7280",
                        borderColor: form.services.includes(s.key) ? s.text : "#e5e7eb",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Currency</label>
                  <select className="form-input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="form-label">Budget</label>
                  <input
                    className="form-input"
                    type="number"
                    value={Number(form.budget) === 0 ? "" : form.budget}
                    onChange={(e) => {
                      const budgetVal = Number(e.target.value) || 0;
                      const paidVal = Number(form.paid) || 0;
                      setForm({ ...form, budget: e.target.value, remaining: (budgetVal - paidVal).toString() });
                    }}
                    placeholder="Total Budget"
                  />
                </div>
                <div>
                  <label className="form-label">Due</label>
                  <input
                    className="form-input"
                    type="number"
                    value={Number(form.due) === 0 ? "" : form.due}
                    onChange={(e) => setForm({ ...form, due: e.target.value })}
                    placeholder="Amount Due"
                  />
                </div>
                <div>
                  <label className="form-label">Paid</label>
                  <input
                    className="form-input"
                    type="number"
                    value={Number(form.paid) === 0 ? "" : form.paid}
                    onChange={(e) => {
                      const paidVal = Number(e.target.value) || 0;
                      const budgetVal = Number(form.budget) || 0;
                      setForm({ ...form, paid: e.target.value, remaining: (budgetVal - paidVal).toString() });
                    }}
                    placeholder="Paid"
                  />
                </div>
                <div>
                  <label className="form-label">Remaining</label>
                  <input
                    className="form-input bg-gray-50 text-gray-500"
                    type="number"
                    value={Number(form.remaining) === 0 ? "" : form.remaining}
                    readOnly
                    placeholder="Auto Calculated"
                  />
                </div>
              </div>
              <div><label className="form-label">Notes</label><textarea className="form-input resize-none" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border text-sm font-medium" style={{ borderColor: "#e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50" style={{ background: "#0D1B3E" }}>
                {saving ? "Saving..." : editing ? "Update" : "Add Client"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .form-label { display: block; font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px; }
        .form-input { width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 13px; color: #1a1a2e; outline: none; transition: border-color 0.15s; background: white; font-family: var(--font-poppins); }
        .form-input:focus { border-color: #C9A84C; }
        .client-panel {
          animation: slideInPanel 0.2s ease-out;
        }
        @keyframes slideInPanel {
          from {
            transform: translateX(-100%);
            opacity: 0.6;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      <CreateProjectModal 
        isOpen={showProjectModal}
        onClose={() => {
          setShowProjectModal(false);
          setSelectedClientForProject(undefined);
        }}
        initialClient={selectedClientForProject}
      />
    </div>
  );
}
