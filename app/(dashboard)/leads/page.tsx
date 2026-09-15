"use client";
import { X, Rocket, Search, Calendar, AlertTriangle, BarChart3, Trophy, TrendingDown, User, Handshake, Trash2 } from "lucide-react";


import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Lead, ServiceTag, LeadStage } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { PipelineService } from "@/lib/pipeline-service";
import { PhoneInput } from "@/components/phone-input";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/toast";

const STAGES: { key: LeadStage; label: string; color: string; bg: string; border: string }[] = [
  { key: "lead",     label: "Lead",     color: "#7e22ce", bg: "#faf5ff", border: "#e9d5ff" },
  { key: "meeting",  label: "Meeting",  color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
  { key: "proposal", label: "Proposal", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  { key: "won",      label: "Won",      color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  { key: "lost",     label: "Lost",     color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
];

const NEXT_ACTIONS: Record<LeadStage, string[]> = {
  lead:     ["Send intro email", "Make a call", "Connect on LinkedIn", "Research the client", "Schedule discovery call"],
  meeting:  ["Send meeting invite", "Prepare presentation", "Send agenda", "Follow up after meeting", "Share case studies"],
  proposal: ["Send proposal", "Follow up on proposal", "Schedule proposal call", "Negotiate terms", "Revise proposal"],
  won:      ["Send contract", "Schedule kickoff", "Onboard client", "Collect advance payment", "Set up project"],
  lost:     ["Send feedback request", "Re-engage in 3 months", "Add to nurture list", "Understand reason for loss"],
};

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

const SOURCES = ["LinkedIn", "Referral", "Instagram", "Website", "WhatsApp", "Cold Call", "Email Campaign", "Other"];

const EMPTY_FORM = {
  name: "", company: "", email: "", phone: "",
  service: "web-development" as ServiceTag,
  stage: "lead" as LeadStage,
  lifecycleStatus: "Not Contacted",
  followUpDate: "", notes: "", source: "", nextAction: "",
};

import { Suspense } from 'react';

function LeadOpener({ leads, setViewingLead, viewingLead }: { leads: any[], setViewingLead: any, viewingLead: any }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const id = searchParams.get("id");
    if (id && leads.length > 0) {
      const lead = leads.find(l => l.id === id);
      if (lead && (!viewingLead || viewingLead.id !== id)) {
        setViewingLead(lead);
      }
    }
  }, [searchParams, leads, viewingLead, setViewingLead]);
  return null;
}

export default function LeadsPage() {
  const { crmUser } = useAuth();
  const router = useRouter();
  
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState<Lead | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);
  const [isCustomAction, setIsCustomAction] = useState(false);
  const [search, setSearch]     = useState("");
  
  // Quick Task (Schedule Meeting) state
  const [showQuickTask, setShowQuickTask] = useState(false);
  const [quickTaskForm, setQuickTaskForm] = useState({ title: "", description: "", dueDate: "", time: "" });
  const [submittingTask, setSubmittingTask] = useState(false);
  const [selectedLeadForTask, setSelectedLeadForTask] = useState<Lead | null>(null);

  // Drag and drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Lead)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  function openAdd() { setEditing(null); setForm({ ...EMPTY_FORM }); setIsCustomAction(false); setShowModal(true); }
  function openEdit(lead: Lead) {
    setEditing(lead);
    setForm({ name: lead.name, company: lead.company, email: lead.email, phone: lead.phone ?? "", service: lead.service, stage: lead.stage, lifecycleStatus: (lead as any).lifecycleStatus || "Not Contacted", followUpDate: lead.followUpDate ?? "", notes: lead.notes ?? "", source: lead.source ?? "", nextAction: (lead as any).nextAction ?? "" });
    setIsCustomAction(false);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.company || !form.email) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast("Please enter a valid email address.", "error");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      let leadId: string;

      if (editing) {
        await updateDoc(doc(db, "leads", editing.id), { ...form, updatedAt: now });
        leadId = editing.id;
      } else {
        const leadRef = await addDoc(collection(db, "leads"), { ...form, assignedTo: crmUser?.uid ?? "", createdAt: now, updatedAt: now, active: true });
        leadId = leadRef.id;
      }

      const leadData = { ...form, id: leadId, assignedTo: editing?.assignedTo || crmUser?.uid || "", createdAt: editing?.createdAt || now, updatedAt: now } as unknown as Lead;
      
      await PipelineService.syncLeadDetails(leadData);

      if (form.stage === "won") await PipelineService.markAsWon(leadData);
      else if (form.stage === "lost") await PipelineService.markAsLost(leadId, form.email, "lead");
      else if (form.stage === "proposal") {
        await PipelineService.transitionToProposal(leadData, crmUser?.uid ?? "");
        router.push(`/proposals?editLead=${leadId}`);
      }
      else await PipelineService.updateStage(leadData as Lead, form.stage, crmUser?.uid);

      setShowModal(false);
      toast("Lead saved successfully!", "success");
    } catch (error) {
      console.error("Error saving lead:", error);
      toast("Failed to save lead.", "error");
    } finally { setSaving(false); }
  }

  async function handleQuickTask() {
    if (!selectedLeadForTask) return;
    if (!quickTaskForm.title || !quickTaskForm.dueDate) {
      alert("Title and Date are required!");
      return;
    }
    setSubmittingTask(true);
    try {
      await addDoc(collection(db, "tasks"), {
        title: quickTaskForm.title,
        description: quickTaskForm.description,
        assignedTo: crmUser?.uid || "",
        assignedToName: crmUser?.name || "System",
        assignedBy: crmUser?.uid || "System",
        clientId: selectedLeadForTask.id,
        clientName: selectedLeadForTask.company || selectedLeadForTask.name || "",
        relatedTo: "",
        relatedType: "",
        priority: "high",
        status: "not-started",
        done: false,
        taskType: "meeting",
        createdAt: new Date().toISOString(),
        dueDate: quickTaskForm.dueDate || new Date().toISOString()
      });
      
      let timeParams = "";
      if (quickTaskForm.dueDate && quickTaskForm.time) {
         const startDate = new Date(`${quickTaskForm.dueDate}T${quickTaskForm.time}`);
         if (!isNaN(startDate.getTime())) {
           const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later
           timeParams = `&startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}`;
         }
      }
      const url = `https://teams.microsoft.com/l/meeting/new?subject=${encodeURIComponent(quickTaskForm.title || "New Meeting")}&content=${encodeURIComponent(quickTaskForm.description || "Meeting notes")}${selectedLeadForTask.email ? `&attendees=${selectedLeadForTask.email}` : ""}${timeParams}`;
      window.open(url, "_blank");

      setShowQuickTask(false);
      setQuickTaskForm({ title: "", description: "", dueDate: "", time: "" });
      setSelectedLeadForTask(null);
    } catch (e: any) {
      alert("Failed:" + e.message);
    } finally {
      setSubmittingTask(false);
    }
  }

  async function deleteLead(id: string) {
    if (!confirm("Delete this lead?")) return;
    await PipelineService.deleteLeadAndRelations(id);
  }

  async function moveStage(lead: Lead, stage: LeadStage) {
    try {
      if (stage === "won") await PipelineService.markAsWon(lead);
      else if (stage === "lost") await PipelineService.markAsLost(lead.id, lead.email, "lead");
      else if (stage === "proposal") {
        await PipelineService.transitionToProposal(lead, crmUser?.uid ?? "");
        router.push(`/proposals?editLead=${lead.id}`);
      }
      else await PipelineService.updateStage(lead, stage, crmUser?.uid);
      toast(`Stage updated to ${stage}`, "success");
    } catch (error: any) {
      console.error("Error moving stage:", error);
      toast("Failed to update stage:" + (error.message || "Unknown error"), "error");
    }
  }

  // --- Drag and Drop Handlers ---
  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("leadId", id);
    setDraggingId(id);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
  };

  const handleBoardDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = e.currentTarget;
    const threshold = 150;
    const scrollSpeed = 15;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    if (x < threshold) {
      container.scrollLeft -= scrollSpeed;
    } else if (rect.width - x < threshold) {
      container.scrollLeft += scrollSpeed;
    }
  };

  const onDrop = async (e: React.DragEvent, stageKey: LeadStage) => {
    e.preventDefault();
    setDraggingId(null);
    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.stage === stageKey) return;
    await moveStage(lead, stageKey);
  };

  const svcInfo  = (key: string) => SERVICES.find((s) => s.key === key) ?? { key: "other", label: key?.toUpperCase() || "OTHER", bg: "#f3f4f6", text: "#374151" };
  const stgInfo  = (key: string) => STAGES.find((s) => s.key === key) ?? { key: "lead", label: key?.toUpperCase() || "LEAD", color: "#7e22ce", bg: "#faf5ff", border: "#e9d5ff" };

  // We do NOT filter out active === false here because leads marked as 'lost' are set to active: false
  // and we want them to appear in the "Lost" column.
  const filteredLeads = leads
    .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.company.toLowerCase().includes(search.toLowerCase()));

  // Summary Metrics
  const totalLeads = leads.length;
  const inProgress = leads.filter(l => l.active !== false && l.stage !== "won" && l.stage !== "lost").length;
  const wonLeads = leads.filter(l => l.stage === "won").length;
  const lostLeads = leads.filter(l => l.stage === "lost").length;

  return (
    <div className="p-8 h-screen flex flex-col overflow-hidden bg-[#f8f9fa]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            Leads
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track your active opportunities.</p>
        </div>
        <button onClick={openAdd} className="btn-primary shadow-md hover:shadow-lg transition-all">
          <span className="text-base mr-1">+</span> New Lead
        </button>
      </div>

      {/* Premium Summary Bar */}
      <div className="flex gap-4 mb-6 flex-shrink-0">
        <div className="bg-white rounded-xl p-4 flex-1 border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Leads</p>
            <p className="text-2xl font-black text-slate-800">{totalLeads}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-xl"><BarChart3 className="inline-block w-4 h-4 shrink-0 mr-1" /></div>
        </div>
        <div className="bg-white rounded-xl p-4 flex-1 border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">In Progress</p>
            <p className="text-2xl font-black text-blue-900">{inProgress}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xl"><Rocket className="inline-block w-4 h-4 shrink-0 mr-1" /></div>
        </div>
        <div className="bg-white rounded-xl p-4 flex-1 border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">Won Leads</p>
            <p className="text-2xl font-black text-emerald-900">{wonLeads}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-xl"><Trophy className="inline-block w-4 h-4 shrink-0 mr-1" /></div>
        </div>
        <div className="bg-white rounded-xl p-4 flex-1 border border-slate-200/60 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">Lost Leads</p>
            <p className="text-2xl font-black text-rose-900">{lostLeads}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-xl"><TrendingDown className="inline-block w-4 h-4 shrink-0 mr-1" /></div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6 flex-shrink-0">
        <div className="relative max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Search className="inline-block w-4 h-4 shrink-0 mr-1" /></span>
          <input
            className="w-full bg-white border border-slate-200 text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            placeholder="Search leads by name or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Kanban Board Area */}
      <div 
        className="flex-1 overflow-x-auto overflow-y-hidden pb-4"
        onDragOver={handleBoardDragOver}
      >
        {loading ? (
          <div className="flex gap-4 h-full">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-[320px] flex-shrink-0 bg-slate-100 rounded-2xl animate-pulse h-full" />
            ))}
          </div>
        ) : (
          <div className="flex gap-5 h-full items-start">
            {STAGES.map(stage => {
              const stageLeads = filteredLeads.filter(l => l.stage === stage.key);
              
              return (
                <div 
                  key={stage.key} 
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, stage.key)}
                  className="w-[340px] flex-shrink-0 flex flex-col max-h-full rounded-2xl border transition-colors duration-200"
                  style={{
                    background: "rgba(255,255,255,0.4)",
                    borderColor: stage.border,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.02)"
                  }}
                >
                  {/* Column Header */}
                  <div className="px-4 py-3 border-b flex items-center justify-between bg-white rounded-t-2xl" style={{ borderColor: stage.border }}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: stage.color }} />
                      <h3 className="font-bold text-sm" style={{ color: "#0D1B3E" }}>{stage.label}</h3>
                    </div>
                    <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: stage.bg, color: stage.color }}>
                      {stageLeads.length}
                    </span>
                  </div>

                  {/* Cards Container */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                    {stageLeads.map(lead => {
                      const svc = svcInfo(lead.service);
                      const isOverdue = lead.followUpDate && new Date(lead.followUpDate) < new Date(new Date().setHours(0,0,0,0));
                      const isDragging = draggingId === lead.id;

                      return (
                        <div 
                          key={lead.id} 
                          draggable
                          onDragStart={(e) => onDragStart(e, lead.id)}
                          onDragEnd={() => setDraggingId(null)}
                          onClick={() => openEdit(lead)} 
                          className={`bg-white p-4 rounded-xl border cursor-grab active:cursor-grabbing transition-all group ${
                            isDragging ? "opacity-50 scale-95" : "opacity-100 scale-100 hover:shadow-md hover:-translate-y-0.5"
                          }`}
                          style={{
                            borderColor: isOverdue ? "#fca5a5" : "#e2e8f0",
                            boxShadow: isOverdue ? "0 4px 12px rgba(239,68,68,0.1)" : "0 2px 8px rgba(0,0,0,0.04)"
                          }}
                        >
                          {/* Top Row: Service & Overdue Badge */}
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ background: svc.bg, color: svc.text }}>
                              {svc.label}
                            </span>
                            {isOverdue && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                                <AlertTriangle className="inline-block w-4 h-4 shrink-0 mr-1" /> Overdue
                              </span>
                            )}
                          </div>

                          {/* Contact Info */}
                          <div className="mb-3">
                            <h4 className="font-bold text-[15px] text-slate-900 leading-tight mb-0.5 group-hover:text-blue-600 transition-colors">{lead.company}</h4>
                            <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px]"><User className="inline-block w-4 h-4 shrink-0 mr-1" /></span>
                              {lead.name}
                            </p>
                          </div>
                          
                          {/* Next Action */}
                          {((lead as any).nextAction || lead.followUpDate) && (
                            <div className="bg-slate-50 rounded-lg p-2 mb-3 border border-slate-100">
                              {(lead as any).nextAction && (
                                <p className="text-xs text-slate-600 font-medium leading-snug line-clamp-2 mb-1.5">
                                  <span className="text-slate-400 mr-1">↳</span>{(lead as any).nextAction}
                                </p>
                              )}
                              {lead.followUpDate && (
                                <p className="text-[11px] font-semibold flex items-center gap-1" style={{ color: isOverdue ? "#ef4444" : "#64748b" }}>
                                  <Calendar className="inline-block w-4 h-4 shrink-0 mr-1" /> {new Date(lead.followUpDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Quick Actions Footer */}
                          <div className="flex gap-1.5 pt-2 border-t border-slate-100 overflow-x-auto pb-1 no-scrollbar opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedLeadForTask(lead);
                                setShowQuickTask(true);
                              }} 
                              className="w-full py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Handshake className="w-3.5 h-3.5" /> Schedule Meeting
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    
                    {stageLeads.length === 0 && (
                      <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-xs text-slate-400 font-medium">Drop leads here</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay z-50">
          <div className="modal-box shadow-2xl" style={{ maxWidth: 600 }}>
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">{editing ? "Edit Lead" : "Add New Lead"}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"><X className="inline-block w-4 h-4 shrink-0 mr-1" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label text-xs font-bold uppercase tracking-wide text-slate-500">Full Name *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Smith" /></div>
                <div><label className="form-label text-xs font-bold uppercase tracking-wide text-slate-500">Company *</label><input className="form-input" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Acme Corp" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label text-xs font-bold uppercase tracking-wide text-slate-500">Email *</label><input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div>
                  <label className="form-label text-xs font-bold uppercase tracking-wide text-slate-500">Phone</label>
                  <PhoneInput value={form.phone} onChange={(val) => setForm({ ...form, phone: val })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label text-xs font-bold uppercase tracking-wide text-slate-500">Service</label>
                  <select className="form-input" value={form.service} onChange={e => setForm({ ...form, service: e.target.value as ServiceTag })}>
                    {SERVICES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs font-bold uppercase tracking-wide text-slate-500">Stage</label>
                  <select className="form-input" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as LeadStage, nextAction: "" })}>
                    {STAGES.filter(s => s.key !== "lead" || form.stage === "lead").map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label text-xs font-bold uppercase tracking-wide text-slate-500">Lifecycle Status</label>
                  <select className="form-input" value={(form as any).lifecycleStatus || "Not Contacted"} onChange={e => setForm({ ...form, lifecycleStatus: e.target.value })}>
                    <option value="Not Contacted">Not Contacted</option>
                    <option value="Attempted to Contact">Attempted to Contact</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Pre-Qualified">Pre-Qualified</option>
                    <option value="Contact in Future">Contact in Future</option>
                    <option value="Lost Lead">Lost Lead</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs font-bold uppercase tracking-wide text-slate-500">Next Action</label>
                  <select className="form-input" value={isCustomAction ? "custom" : form.nextAction}
                    onChange={e => {
                      if (e.target.value === "custom") { setIsCustomAction(true); setForm({ ...form, nextAction: "" }); }
                      else { setIsCustomAction(false); setForm({ ...form, nextAction: e.target.value }); }
                    }}>
                    <option value="">Select next action...</option>
                    {NEXT_ACTIONS[form.stage].map(a => <option key={a} value={a}>{a}</option>)}
                    <option value="custom">Custom...</option>
                  </select>
                  {isCustomAction && (
                    <input className="form-input mt-2" placeholder="Type your custom action..." value={form.nextAction} autoFocus onChange={e => setForm({ ...form, nextAction: e.target.value })} />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="form-label text-xs font-bold uppercase tracking-wide text-slate-500">Follow-up Date</label><input className="form-input" type="date" value={form.followUpDate} onChange={e => setForm({ ...form, followUpDate: e.target.value })} /></div>
                <div>
                  <label className="form-label text-xs font-bold uppercase tracking-wide text-slate-500">Source</label>
                  <select className="form-input" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                    <option value="">Select source...</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="form-label text-xs font-bold uppercase tracking-wide text-slate-500">Notes</label><textarea className="form-input resize-none" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes..." /></div>
            </div>

            {form.stage === "won" && (
              <div className="mt-4 px-4 py-3 rounded-xl text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                ℹ️ Marking as <strong>Won</strong> tags this as a successful lead. To convert them to an active <strong>Client</strong>, you must generate and accept a Proposal.
              </div>
            )}

            <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-100">
              {editing ? (
                <button onClick={() => deleteLead(editing.id)} className="text-red-500 text-sm font-bold hover:text-red-700 transition-colors flex items-center">
                  <Trash2 className="inline-block w-4 h-4 shrink-0 mr-1" /> Delete Lead
                </button>
              ) : <div/>}
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.name || !form.company || !form.email} className="btn-primary px-8 disabled:opacity-50 shadow-md hover:shadow-lg transition-all">
                  {saving ? "Saving..." : editing ? "Update Lead" : "Create Lead"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Quick Task Modal */}
      {showQuickTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowQuickTask(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-900 capitalize">Schedule a Meeting</h3>
              <button onClick={() => setShowQuickTask(false)} className="text-slate-400 hover:text-slate-700"><X className="inline-block w-4 h-4 shrink-0 mr-1" /></button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4">
                <p className="text-xs text-blue-800 font-medium leading-relaxed">
                  Fill in the details below to schedule a meeting with <strong>{selectedLeadForTask?.name} ({selectedLeadForTask?.company})</strong>. This will save a task in the CRM and open a new MS Teams Meeting window.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Meeting Title *</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-colors text-sm font-medium placeholder-slate-400"
                  placeholder="e.g. Intro Call"
                  value={quickTaskForm.title}
                  onChange={e => setQuickTaskForm({...quickTaskForm, title: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Meeting Agenda</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-colors text-sm font-medium min-h-[80px] resize-none placeholder-slate-400"
                  placeholder="Points to discuss..."
                  value={quickTaskForm.description}
                  onChange={e => setQuickTaskForm({...quickTaskForm, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Date *</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-colors text-sm font-medium text-slate-700"
                    value={quickTaskForm.dueDate}
                    onChange={e => setQuickTaskForm({...quickTaskForm, dueDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Time</label>
                  <input 
                    type="time" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-blue-500 transition-colors text-sm font-medium text-slate-700"
                    value={quickTaskForm.time}
                    onChange={e => setQuickTaskForm({...quickTaskForm, time: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50/50">
              <button onClick={() => setShowQuickTask(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600">Cancel</button>
              <button 
                disabled={submittingTask}
                onClick={handleQuickTask}
                className="flex-[2] py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-transform active:scale-[0.98]"
              >
                {submittingTask ? "Saving..." : "Save & Schedule in Teams"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
