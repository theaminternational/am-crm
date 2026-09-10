"use client";

import { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ServiceTag, ProjectStatus } from "@/types";
import { useAuth } from "@/lib/auth-context";

const STATUSES: { key: ProjectStatus; label: string; color: string; bg: string }[] = [
  { key: "not-started", label: "Not Started", color: "#6b7280", bg: "#f9fafb" },
  { key: "in-progress", label: "In Progress", color: "#1d4ed8", bg: "#eff6ff" },
  { key: "review",      label: "In Review",   color: "#b35a00", bg: "#fff7ed" },
  { key: "completed",   label: "Completed",   color: "#15803d", bg: "#f0fdf4" },
  { key: "on-hold",     label: "On Hold",     color: "#b91c1c", bg: "#fef2f2" },
];

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

const SERVICE_TECH_STACKS: Record<string, string[]> = {
  "web-development": ["Next.js", "React", "TypeScript", "Tailwind CSS", "Node.js", "Firestore", "Three.js", "GSAP"],
  "ui-ux": ["Figma", "Design System", "Framer", "Prototyping", "Wireframing", "Tailwind CSS"],
  "digital-marketing": ["Meta Ads", "Google Ads", "Analytics", "HubSpot", "SEO Audit", "Content Strategy"],
  "seo": ["Google Search Console", "Ahrefs", "Semrush", "Technical SEO", "Schema Markup", "PageSpeed"],
  "social-media": ["Meta Business Suite", "Canva", "TikTok Ads", "Copywriting", "Video Editing", "Content Calendar"],
  "branding": ["Brand Guidelines", "Logo Vectors", "Typography", "Color Palette", "Brand Deck"],
  "technology-services": ["AWS", "Azure", "Docker", "Kubernetes", "CI/CD", "Microservices", "REST API"],
  "oracle-epm": ["Oracle Cloud EPM", "FCC", "PBCS", "Financial Consolidation", "Essbase", "Smart View"],
  "other": ["Custom Stack", "Cloud Infra", "API Integration", "Database"]
};

const DEFAULT_STACK = ["Next.js", "Three.js", "Tailwind", "Node.js", "Firestore", "GSAP"];

const CURRENCIES = [
  { code: "AED", label: "AED (Dirham)" },
  { code: "USD", label: "USD (Dollar)" },
  { code: "INR", label: "INR (Rupee)" },
  { code: "EUR", label: "EUR (Euro)" },
  { code: "GBP", label: "GBP (Pound)" },
];

const EMPTY_FORM = {
  clientId: "", clientName: "", title: "", service: "web-development" as ServiceTag,
  status: "not-started" as ProjectStatus, deadline: "",
  description: "", budget: "", due: "", remaining: "", paid: "", currency: "AED",
  masterBlueprint: "",
  leadInstructions: "",
  projectSummary: "",
  techStack: [] as string[],
  figmaUrl: "",
  repoUrl: "",
  stagingUrl: "",
  productionUrl: "",
  coreFocus: "Dynamic Web App",
  assignedTo: [] as string[],
};

export default function CreateProjectModal({ 
  isOpen, 
  onClose, 
  initialClient 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  initialClient?: { id: string, name: string } 
}) {
  const { crmUser } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [customTech, setCustomTech] = useState("");

  useEffect(() => {
    if (isOpen && initialClient) {
      setForm({ ...EMPTY_FORM, clientId: initialClient.id, clientName: initialClient.name });
    } else if (isOpen) {
      setForm(EMPTY_FORM);
    }
  }, [isOpen, initialClient]);

  useEffect(() => {
    if (!isOpen) return;
    const unsubUsers = onSnapshot(collection(db, "users"), snap => {
      setMembers(snap.docs.map((d) => ({ id: d.id, uid: d.id, ...d.data() })));
    });
    
    let unsubClients = () => {};
    if (!initialClient) {
      unsubClients = onSnapshot(query(collection(db, "clients"), where("active", "!=", false)), snap => {
        setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    return () => {
      unsubUsers();
      unsubClients();
    };
  }, [isOpen, initialClient]);

  if (!isOpen) return null;

  async function handleSave() {
    if (!form.title || !form.clientName) return alert("Title and Client Name are required.");
    setSaving(true);
    try {
      const projectData = {
        title: form.title,
        clientId: form.clientId,
        clientName: form.clientName,
        service: form.service,
        status: form.status,
        deadline: form.deadline,
        description: form.description,
        budget: Number(form.budget) || 0,
        due: Number(form.due) || 0,
        remaining: Number(form.remaining) || 0,
        paid: Number(form.paid) || 0,
        currency: form.currency,
        assignedTo: form.assignedTo,
        masterBlueprint: form.masterBlueprint,
        techStack: form.techStack,
        figmaUrl: form.figmaUrl,
        repoUrl: form.repoUrl,
        stagingUrl: form.stagingUrl,
        productionUrl: form.productionUrl,
        coreFocus: form.coreFocus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, "projects"), projectData);
      onClose();
    } catch (e: any) {
      alert("Failed to create project: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 overflow-y-auto max-h-[90vh]" style={{ background: "white" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: "#0D1B3E", fontFamily: "var(--font-playfair)" }}>New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="space-y-4">
          <div><label className="block text-xs font-bold text-slate-500 mb-1">Project Title *</label><input className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Website Redesign" /></div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Client Name *</label>
            {initialClient ? (
              <input className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-slate-50 text-slate-500" value={form.clientName} readOnly />
            ) : (
              <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900" value={form.clientId} onChange={(e) => {
                const selectedClient = clients.find(c => c.id === e.target.value);
                setForm({ ...form, clientId: e.target.value, clientName: selectedClient ? (selectedClient.company || selectedClient.name) : "" });
              }}>
                <option value="">Select a Client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Service</label>
              <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value as ServiceTag })}>
                {SERVICES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
              <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className={crmUser?.role === "admin" ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
            <div><label className="block text-xs font-bold text-slate-500 mb-1">Deadline</label><input className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
            {crmUser?.role === "admin" && (
              <div className="flex gap-2">
                <div className="w-24">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Currency</label>
                  <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">Budget</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900"
                    type="number"
                    value={Number(form.budget) === 0 ? "" : form.budget}
                    onChange={(e) => {
                      const budgetVal = Number(e.target.value) || 0;
                      const paidVal = Number(form.paid) || 0;
                      setForm({
                        ...form,
                        budget: e.target.value,
                        remaining: (budgetVal - paidVal).toString()
                      });
                    }}
                    placeholder="Total Budget"
                  />
                </div>
              </div>
            )}
          </div>
          {crmUser?.role === "admin" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Due</label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900"
                  type="number"
                  value={Number(form.due) === 0 ? "" : form.due}
                  onChange={(e) => setForm({ ...form, due: e.target.value })}
                  placeholder="Amount Due"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Paid</label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900"
                  type="number"
                  value={Number(form.paid) === 0 ? "" : form.paid}
                  onChange={(e) => {
                    const paidVal = Number(e.target.value) || 0;
                    const budgetVal = Number(form.budget) || 0;
                    setForm({
                      ...form,
                      paid: e.target.value,
                      remaining: (budgetVal - paidVal).toString()
                    });
                  }}
                  placeholder="Amount Paid"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Remaining</label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none bg-slate-50 text-slate-500"
                  type="number"
                  value={Number(form.remaining) === 0 ? "" : form.remaining}
                  readOnly
                  placeholder="Remaining"
                />
              </div>
            </div>
          )}
          <div className="col-span-full">
            <label className="block text-xs font-bold text-slate-500 mb-1">Master Blueprint</label>
            <textarea 
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900 resize-none" 
              rows={4} 
              value={form.masterBlueprint} 
              onChange={(e) => setForm({ ...form, masterBlueprint: e.target.value })} 
              placeholder="Enter the comprehensive project blueprint (e.g. phases, milestones, architecture)..." 
            />
          </div>

          {/* Environment Provisioning Section */}
          <div className="border-t pt-4 mt-4" style={{ borderColor: "#f0f0f5" }}>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-3 text-slate-500">Environment Provisioning</h4>
            
            {/* Tech Stack Dropdown & Custom Input */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 mb-1">Core Architecture Stack</label>
              
              <div className="flex gap-2 mb-2">
                <select 
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900 bg-white"
                  onChange={(e) => {
                    const tech = e.target.value;
                    if (tech && !form.techStack.includes(tech)) {
                      setForm({ ...form, techStack: [...form.techStack, tech] });
                    }
                    e.target.value = ""; // Reset after selection
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Select predefined stack...</option>
                  {(SERVICE_TECH_STACKS[form.service] || DEFAULT_STACK).map((tech) => (
                    <option key={tech} value={tech} disabled={form.techStack.includes(tech)}>{tech}</option>
                  ))}
                </select>

                <input 
                  type="text"
                  placeholder="Custom stack..."
                  className="w-1/3 px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] text-slate-900 bg-white"
                  value={customTech}
                  onChange={(e) => setCustomTech(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (customTech.trim() && !form.techStack.includes(customTech.trim())) {
                        setForm({ ...form, techStack: [...form.techStack, customTech.trim()] });
                        setCustomTech("");
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customTech.trim() && !form.techStack.includes(customTech.trim())) {
                      setForm({ ...form, techStack: [...form.techStack, customTech.trim()] });
                      setCustomTech("");
                    }
                  }}
                  className="px-4 py-2.5 bg-[#0D1B3E] text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Selected Stack Pills */}
              <div className="flex flex-wrap gap-2 mt-2">
                {form.techStack.map((tech) => (
                  <div key={tech} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#0D1B3E] text-[#C9A84C] text-xs font-bold border border-[#0D1B3E]">
                    {tech}
                    <button type="button" className="ml-1 text-[#C9A84C]/70 hover:text-white" onClick={() => setForm({ ...form, techStack: form.techStack.filter((t) => t !== tech) })}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Core Focus Toggle */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 mb-1">Primary Core Focus</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {["Dynamic Web App", "Static Branding", "E-Commerce Build"].map((focus) => {
                  const selected = form.coreFocus === focus;
                  return (
                    <button
                      key={focus}
                      type="button"
                      onClick={() => setForm({ ...form, coreFocus: focus })}
                      className={`py-2 px-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                        selected
                          ? "bg-[#C9A84C] text-[#0D1B3E] border-[#C9A84C] shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {focus}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4 mt-4" style={{ borderColor: "#f0f0f5" }}>
            <label className="block text-xs font-bold text-slate-500 mb-1">Assign Team Members</label>
            <div className="grid grid-cols-2 gap-2 mt-2 p-3 rounded-xl border border-slate-200">
              {members.map((m) => (
                <label key={m.uid} className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-[#0D1B3E] focus:ring-[#0D1B3E]"
                    checked={form.assignedTo.includes(m.uid)}
                    onChange={(e) => {
                      const newAssigned = e.target.checked 
                        ? [...form.assignedTo, m.uid]
                        : form.assignedTo.filter(id => id !== m.uid);
                      setForm({ ...form, assignedTo: newAssigned });
                    }}
                  />
                  <span className="text-xs font-medium group-hover:text-[#0D1B3E] text-slate-500">{m.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-500">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50" style={{ background: "#0D1B3E" }}>
            {saving ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
