"use client";
import { X, AlertTriangle, Trash2 } from "lucide-react";


import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Project, ServiceTag, ProjectStatus, SystemTaskType } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { PipelineService } from "@/lib/pipeline-service";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import CreateProjectModal from "@/components/CreateProjectModal";

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

const CURRENCIES = [
  { code: "AED", label: "AED (Dirham)" },
  { code: "USD", label: "USD (Dollar)" },
  { code: "INR", label: "INR (Rupee)" },

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
};

function statusInfo(key: string) {
  return STATUSES.find((s) => s.key === key) ?? STATUSES[0];
}
function serviceInfo(key: string) {
  return SERVICES.find((s) => s.key === key) ?? SERVICES[2];
}

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function ProjectsPage() {
  const { crmUser } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, assignedTo: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [openProjectPanel, setOpenProjectPanel] = useState(false);
  const [activeDropdownProjectId, setActiveDropdownProjectId] = useState<string | null>(null);

  useEffect(() => {
    function openFromSidebar() {
      setOpenProjectPanel(true);
    }
    window.addEventListener("projects:open-panel", openFromSidebar);
    return () => window.removeEventListener("projects:open-panel", openFromSidebar);
  }, []);

  function selectProjectFilter(filter: ProjectStatus | "all") {
    setStatusFilter(filter);
    setOpenProjectPanel(false);
  }

  // Task Delegation State for Projects Page
  const [delegateProject, setDelegateProject] = useState<Project | null>(null);
  const [delegateForm, setDelegateForm] = useState({ employeeId: "", title: "", deadline: "", instructions: "", taskType: "project-task" as SystemTaskType });
  const [delegating, setDelegating] = useState(false);

  const canEdit = crmUser?.role === "admin" || crmUser?.role === "lead";

  const searchParams = useSearchParams();

  useEffect(() => { 
    const unsubProjects = onSnapshot(query(collection(db, "projects"), orderBy("createdAt", "desc")), snap => {
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      if (crmUser && crmUser.role !== "admin") {
        list = list.map(p => {
          const clean = { ...p };
          delete clean.budget;
          delete (clean as any).contractValue;
          delete (clean as any).pipelineValue;
          delete (clean as any).due;
          delete (clean as any).paid;
          delete (clean as any).remaining;
          delete (clean as any).balance;
          delete (clean as any).payments;
          return clean;
        });
      }
      setProjects(list);
      setLoading(false);
    });

    const unsubUsers = onSnapshot(collection(db, "users"), snap => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubClients = onSnapshot(query(collection(db, "clients"), where("active", "!=", false)), snap => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingClients(false);
    });
    
    // Handle redirect from Clients page with smart prefill
    if (searchParams.get("new") === "true") {
      const clientId = searchParams.get("clientId") || "";
      const clientNameFromUrl = searchParams.get("clientName") || "";
      
      const prefillData = async () => {
        let prefill = { ...EMPTY_FORM, clientId, clientName: decodeURIComponent(clientNameFromUrl), assignedTo: [] as string[] };
        
        try {
          if (clientId) {
            const clientDoc = await getDoc(doc(db, "clients", clientId));
            if (clientDoc.exists()) {
              const cData = clientDoc.data();
              prefill.clientName = cData.company || cData.name || prefill.clientName;
              prefill.service = (cData.services && cData.services.length > 0) ? cData.services[0] : "web-development";
              
              // Smart prefill from accepted proposal
              if (cData.email) {
                const propQ = query(
                  collection(db, "proposals"), 
                  where("clientEmail", "==", cData.email),
                  where("status", "in", ["accepted", "won"])
                );
                const propsSnap = await getDocs(propQ);
                
                if (!propsSnap.empty) {
                  // Get the latest accepted proposal
                  const latestProp = propsSnap.docs
                  .map(d => d.data())
                  .sort((a,b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0];
                  
                  prefill.title = `${prefill.clientName} - ${latestProp.service ? latestProp.service.replace(/-/g, " ") : "Project"}`;
                  prefill.budget = latestProp.total?.toString() || "";
                  prefill.due = latestProp.total?.toString() || "";
                  
                  // Smart deadline (e.g. 30 days from now if not specified)
                  const date = new Date();
                  date.setDate(date.getDate() + 30);
                  prefill.deadline = date.toISOString().split("T")[0];
                  
                  // Construct a rich Master Blueprint from proposal scope
                  let scope = [];
                  if (latestProp.introduction) scope.push(`## Introduction\n${latestProp.introduction}`);
                  if (latestProp.approachDescription) scope.push(`## Approach\n${latestProp.approachDescription}`);
                  if (latestProp.executiveSummary) scope.push(`## Executive Summary\n${latestProp.executiveSummary}`);
                  if (latestProp.packages && Array.isArray(latestProp.packages)) {
                    const pkgs = latestProp.packages.map((p: any) => `- ${p.name}: ${p.description || "Included"}`).join("\n");
                    if (pkgs) scope.push(`## Selected Packages\n${pkgs}`);
                  }
                  prefill.masterBlueprint = scope.join("\n\n");
                  
                  prefill.description = "";
                }
              }
            }
          }
        } catch (err) {
          console.error("Error prefilling project data:", err);
        }

        setForm(prefill);
        setEditing(null);
        setShowModal(true);
      };
      
      prefillData(); // Execute async prefill
      router.replace("/projects", { scroll: false }); // Clean up URL without triggering a full route navigation that could break state
    }

    return () => {
      unsubProjects();
      unsubUsers();
      unsubClients();
    };
  }, [searchParams, router, crmUser]);

  function openEdit(p: Project) {
    setEditing(p);
    setForm({ 
      clientId: p.clientId,
      clientName: p.clientName, 
      title: p.title, 
      service: p.service, 
      status: p.status, 
      deadline: p.deadline ?? "", 
      description: p.description ?? "", 
      budget: p.budget?.toString() ?? "",
      due: p.due?.toString() ?? "",
      remaining: p.remaining?.toString() ?? p.balance?.toString() ?? "",
      paid: p.paid?.toString() ?? "",
      currency: p.currency ?? "AED",
      assignedTo: Array.isArray(p.assignedTo) ? p.assignedTo : (p.assignedTo ? [p.assignedTo] : []),
      projectSummary: (p as any).projectSummary ?? "",
      techStack: p.techStack || [],
      figmaUrl: p.figmaUrl ?? "",
      repoUrl: p.repoUrl ?? "",
      stagingUrl: p.stagingUrl ?? "",
      productionUrl: p.productionUrl ?? "",
      coreFocus: p.coreFocus ?? "Dynamic Web App",
      masterBlueprint: p.masterBlueprint ?? "",
      leadInstructions: p.leadInstructions ?? "",
    });
    setShowModal(true);
  }

  async function createTasksForProject(projectId: string, projectData: any) {
    if (!projectData.assignedTo || projectData.assignedTo.length === 0) return;
    
    const now = new Date().toISOString();
    
    // Check if tasks already exist for this project to avoid duplicates
    const existingTasksSnap = await getDocs(query(collection(db, "tasks"), where("relatedTo", "==", projectId)));
    if (!existingTasksSnap.empty) return;

    const assignees = Array.isArray(projectData.assignedTo) ? projectData.assignedTo : [projectData.assignedTo].filter(Boolean);
    for (const uid of assignees) {
      const member = members.find(m => m.uid === uid);
      await addDoc(collection(db, "tasks"), {
        title: projectData.title,
        description: projectData.description || `Task for project: ${projectData.title}`,
        assignedTo: uid,
        assignedToName: member?.name || "Team Member",
        assignedBy: crmUser?.uid || "System",
        clientId: projectData.clientId || "",
        clientName: projectData.clientName || "",
        relatedTo: projectId,
        relatedType: "project",
        priority: "medium",
        status: "not-started",
        done: false,
        createdAt: now,
        dueDate: projectData.deadline || now,
        masterBlueprint: projectData.masterBlueprint || "",
        leadInstructions: projectData.leadInstructions || ""
      });
    }
  }

  async function deleteTasksForProject(projectId: string) {
    try {
      const q = query(collection(db, "tasks"), where("relatedTo", "==", projectId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, "tasks", d.id));
      }
      console.log(`Deleted ${snap.docs.length} tasks for project ${projectId}`);
    } catch (error) {
      console.error("Error deleting tasks for project:", error);
    }
  }

  async function handleSave() {
    if (!form.clientName || !form.title) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const data: any = { 
        ...form, 
        clientId: editing?.clientId || "" 
      };
      
      if (form.budget) data.budget = Number(form.budget);
      else delete data.budget;

      if (form.due) data.due = Number(form.due);
      else delete data.due;

      if (form.paid) data.paid = Number(form.paid);
      else delete data.paid;

      if (form.remaining) data.remaining = Number(form.remaining);
      else delete data.remaining;
      
      // Clean up legacy fields if present
      data.balance = null;

      let projectId = editing?.id;
      if (editing) {
        await updateDoc(doc(db, "projects", editing.id), { ...data, updatedAt: now });
        if (data.status === "in-progress") {
          await createTasksForProject(editing.id, data);
        } else if (data.status === "not-started") {
          await deleteTasksForProject(editing.id);
        }
      } else {
        const docRef = await addDoc(collection(db, "projects"), { ...data, createdAt: now, updatedAt: now });
        projectId = docRef.id;
        if (data.status === "in-progress") {
          await createTasksForProject(projectId, data);
        }
      }
      setShowModal(false);
    } finally { setSaving(false); }
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project? This will also remove associated tasks.")) return;
    await PipelineService.deleteProjectAndRelations(id);
  }

  async function handleDelegateTask() {
    if (!delegateProject || !delegateForm.employeeId || !delegateForm.title) {
      alert("Please specify employee and task title."); return;
    }
    setDelegating(true);
    try {
      const employee = members.find(m => m.uid === delegateForm.employeeId);
      const now = new Date().toISOString();
      await addDoc(collection(db, "tasks"), {
        title: delegateForm.title,
        description: delegateForm.instructions || `Task for project: ${delegateProject.title}`,
        assignedTo: delegateForm.employeeId,
        assignedToName: employee?.name || "Team Member",
        assignedBy: crmUser?.uid || "System",
        clientId: delegateProject.clientId || "",
        clientName: delegateProject.clientName || "",
        relatedTo: delegateProject.id,
        relatedType: "project",
        priority: "medium",
        status: "not-started",
        done: false,
        createdAt: now,
        dueDate: delegateForm.deadline || delegateProject.deadline || now,
        taskInstructions: delegateForm.instructions || "",
        masterBlueprint: (delegateProject as any).masterBlueprint || "",
        leadInstructions: (delegateProject as any).leadInstructions || "",
        taskType: delegateForm.taskType
      });
      alert("Task successfully delegated and assigned!");
      setDelegateProject(null);
      setDelegateForm({ employeeId: "", title: "", deadline: "", instructions: "", taskType: "project-task" as SystemTaskType });
    } catch (e: any) {
      console.error(e);
      alert("Failed to delegate task:" + e.message);
    } finally {
      setDelegating(false);
    }
  }


  async function updateStatus(project: Project, status: ProjectStatus) {
    await PipelineService.updateProjectStatus(project.id, status, crmUser?.uid ?? "");
    
    // Create tasks if moving to in-progress
    if (status === "in-progress") {
      await createTasksForProject(project.id, project);
    }
    
    setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, status } : p));
  }

  // Do not hide projects just because a client is inactive
  const filteredProjects = projects;

  const activeProjects = filteredProjects.filter(p => p.status !== "completed");
  const completedProjects = filteredProjects.filter(p => p.status === "completed");

  const filteredActive = statusFilter === "all" 
    ? activeProjects 
    : statusFilter === "completed" ? [] : activeProjects.filter(p => p.status === statusFilter);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => setOpenProjectPanel(true)} className="flex items-center gap-2 group text-left">
            <h1 className="page-title flex items-center gap-3 mb-0">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              Projects
            </h1>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2.5" className="mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>{activeProjects.filter((p) => p.status === "in-progress").length} active projects</p>
        </div>
        <div className="flex gap-3">
          {crmUser?.role === "admin" && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary"><span className="text-base">+</span> New Project</button>
          )}
        </div>
      </div>

      {/* Project filter panel */}
      {openProjectPanel && (
        <div className="fixed inset-0 z-50" onClick={() => setOpenProjectPanel(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(13, 27, 62, 0.35)", backdropFilter: "blur(2px)" }} />
          <div className="project-panel absolute left-0 top-0 h-full w-[280px] shadow-2xl flex flex-col" style={{ background: "linear-gradient(180deg, #0D1B3E 0%, #142450 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-6 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">Filter Projects</h2>
                <p className="text-[11px] mt-0.5" style={{ color: "#8b93ab" }}>Choose a category</p>
              </div>
              <button onClick={() => setOpenProjectPanel(false)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-[#8b93ab] hover:text-white hover:bg-white/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
              {[
                { key: "all" as const, label: "All Active", dot: "#C9A84C", count: activeProjects.length },
                { key: "not-started" as const, label: "Not Started", dot: "#9ca3af", count: activeProjects.filter((p) => p.status === "not-started").length },
                { key: "in-progress" as const, label: "In Progress", dot: "#3b82f6", count: activeProjects.filter((p) => p.status === "in-progress").length },
                { key: "review" as const, label: "In Review", dot: "#f59e0b", count: activeProjects.filter((p) => p.status === "review").length },
                { key: "on-hold" as const, label: "On Hold", dot: "#ef4444", count: activeProjects.filter((p) => p.status === "on-hold").length },
              ].map((item) => {
                const selected = statusFilter === item.key;
                return (
                  <button key={item.key} onClick={() => selectProjectFilter(item.key)} className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all" style={{ background: selected ? "rgba(201, 168, 76, 0.12)" : "transparent", borderLeft: selected ? "3px solid #C9A84C" : "3px solid transparent", color: selected ? "#C9A84C" : "#c4cadb" }}>
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

      {/* Status filter handled by side panel */}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: "#f3f4f6" }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Active Column */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
              Active Pipeline ({filteredActive.length})
            </h2>
            
            {filteredActive.length === 0 ? (
              <div className="text-center py-12 crm-card border-dashed bg-slate-50/50">
                <p className="text-xs text-slate-400">No active projects found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                {filteredActive.map((project) => {
                  const st = statusInfo(project.status);
                  const svc = serviceInfo(project.service);
                  const isOverdue = project.deadline && new Date(project.deadline) < new Date();
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      key={project.id} 
                      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-[#C9A84C]/50 transition-all cursor-pointer flex flex-col relative group overflow-hidden" 
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-[#0D1B3E] group-hover:bg-[#C9A84C] transition-colors"></div>

                      <div className="flex items-start justify-between mb-4 mt-1">
                        <div className="flex-1 min-w-0 pr-4">
                          <h3 className="text-base font-black text-[#0D1B3E] group-hover:text-[#C9A84C] transition-colors truncate">{project.title}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs font-bold text-slate-500 truncate">{project.clientName}</span>
                            {project.deadline && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isOverdue ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                                  {isOverdue ? <AlertTriangle className="inline-block w-4 h-4 shrink-0 mr-1" />  : ""}Due: {new Date(project.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => openEdit(project)} className="p-1.5 rounded-md text-slate-400 hover:text-[#0D1B3E] hover:bg-slate-100 transition-colors" title="Edit">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            </button>
                            <button onClick={() => deleteProject(project.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border" style={{ background: svc.bg, color: svc.text, borderColor: svc.text + '33' }}>{svc.label.split(" ")[0]}</span>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border" style={{ background: st.bg, color: st.color, borderColor: st.color + '33' }}>{st.label}</span>
                      </div>

                      {/* Overlapping circular avatar badges of assigned employees */}
                      <div className="flex -space-x-2 overflow-hidden mb-3">
                        {(Array.isArray(project.assignedTo) ? project.assignedTo : [project.assignedTo].filter(Boolean)).map((uid: string) => {
                          const member = members.find((m) => m.uid === uid);
                          if (!member) return null;
                          return (
                            <div 
                              key={uid} 
                              className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-sm flex-shrink-0"
                              style={{ background: "#0D1B3E" }}
                              title={member.name}
                            >
                              {member.name ? getInitials(member.name) : "?"}
                            </div>
                          );
                        })}
                      </div>


                      {/* Quick status change & Delegate Menu */}
                      {canEdit && (
                        <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: "#f0f0f5" }} onClick={(e) => e.stopPropagation()}>
                          <div className="relative">
                            <button 
                              onClick={() => setActiveDropdownProjectId(activeDropdownProjectId === project.id ? null : project.id)}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-white flex items-center gap-1 transition-colors hover:bg-slate-50"
                              style={{ color: "#0D1B3E", borderColor: "#e5e7eb" }}
                            >
                              Change Status ▼
                            </button>
                            {activeDropdownProjectId === project.id && (
                              <div className="absolute left-0 bottom-full mb-1 w-40 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-50">
                                {STATUSES.map((s) => (
                                  <button
                                    key={s.key}
                                    onClick={() => {
                                      updateStatus(project, s.key);
                                      setActiveDropdownProjectId(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                    style={{ color: s.color }}
                                  >
                                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }}></span>
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => {
                              setDelegateProject(project);
                              setDelegateForm({ 
                                employeeId: "", 
                                title: "", 
                                deadline: project.deadline || "", 
                                instructions: "",
                                taskType: "project-task" 
                              });
                            }}
                            className="text-xs font-bold text-[#C9A84C] hover:underline flex items-center gap-1"
                          >
                            Delegate
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Completed Column */}
          <div className="space-y-6">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              Success Archive ({completedProjects.length})
            </h2>

            <div className="space-y-3">
              {completedProjects.length === 0 ? (
                <div className="text-center py-8 rounded-2xl border-2 border-dashed border-slate-100">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No archived projects</p>
                </div>
              ) : (
                completedProjects.map(p => (
                  <div 
                    key={p.id} 
                    className="bg-white rounded-xl p-4 border border-slate-200 hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => router.push(`/projects/${p.id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">{p.title}</p>
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">COMPLETED</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">{p.clientName}</p>
                    

                    {/* Revert option */}
                    {canEdit && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); updateStatus(p, "in-progress"); }}
                        className="w-full mt-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:text-blue-600 hover:border-blue-200 transition-all"
                      >
                        ↩ Revert to Active
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 overflow-y-auto max-h-[90vh]" style={{ background: "white" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "#0D1B3E", fontFamily: "var(--font-playfair)" }}>{editing ? "Edit Project" : "New Project"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl"><X className="inline-block w-4 h-4 shrink-0 mr-1" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="form-label">Project Title *</label><input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Website Redesign" /></div>
              <div>
                <label className="form-label">Client *</label>
                <select 
                  className="form-input" 
                  value={form.clientId || ""} 
                  onChange={(e) => {
                    const c = clients.find(cl => cl.id === e.target.value);
                    setForm({ ...form, clientId: e.target.value, clientName: c ? (c.company || c.name) : "" });
                  }}
                >
                  <option value="">-- Select Client --</option>
                  {clients.filter(c => c.active !== false).map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Service</label>
                  <select className="form-input" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value as ServiceTag })}>
                    {SERVICES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
                    {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className={crmUser?.role === "admin" ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
                <div><label className="form-label">Deadline</label><input className="form-input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
                {crmUser?.role === "admin" && (
                  <div className="flex gap-2">
                    <div className="w-24">
                      <label className="form-label">Currency</label>
                      <select className="form-input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                        {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="form-label">Budget</label>
                      <input
                        className="form-input"
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
                    <label className="form-label">Remaining</label>
                    <input
                      className="form-input bg-gray-50 text-gray-500"
                      type="number"
                      value={Number(form.remaining) === 0 ? "" : form.remaining}
                      readOnly
                      placeholder="Remaining"
                    />
                  </div>
                </div>
              )}
              <div className="col-span-full">
                <label className="form-label">Master Blueprint</label>
                <textarea 
                  className="form-input resize-none" 
                  rows={4} 
                  value={form.masterBlueprint} 
                  onChange={(e) => setForm({ ...form, masterBlueprint: e.target.value })} 
                  placeholder="Enter the comprehensive project blueprint (e.g. phases, milestones, architecture)..." 
                />
              </div>

              {/* Environment Provisioning Section */}
              <div className="border-t pt-4 mt-4" style={{ borderColor: "#f0f0f5" }}>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3 text-slate-500">Environment Provisioning</h4>
                
                {/* Tech Stack Pills */}
                <div className="mb-4">
                  <label className="form-label">Core Architecture Stack (Select framework environments)</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {((SERVICE_TECH_STACKS as any)[form.service] || ["Next.js", "Three.js", "Tailwind", "Node.js", "Firestore", "GSAP"]).map((tech: string) => {
                      const selected = form.techStack.includes(tech);
                      return (
                        <button
                          key={tech}
                          type="button"
                          onClick={() => {
                            const newStack = selected
                              ? form.techStack.filter((t) => t !== tech)
                              : [...form.techStack, tech];
                            setForm({ ...form, techStack: newStack });
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            selected 
                              ? "bg-[#0D1B3E] text-[#C9A84C] border-[#0D1B3E] font-bold" 
                              : "bg-white text-slate-600 border-slate-200 hover:border-[#0D1B3E]"
                          }`}
                        >
                          {tech}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Core Focus Toggle */}
                <div className="mb-4">
                  <label className="form-label">Primary Core Focus</label>
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

                {/* URL Inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="form-label">Figma Canvas URL</label>
                    <input className="form-input" value={form.figmaUrl} onChange={(e) => setForm({ ...form, figmaUrl: e.target.value })} placeholder="https://figma.com/file/..." />
                  </div>
                  <div>
                    <label className="form-label">Repository Endpoint</label>
                    <input className="form-input" value={form.repoUrl} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} placeholder="https://github.com/..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Staging Environment Link</label>
                      <input className="form-input" value={form.stagingUrl} onChange={(e) => setForm({ ...form, stagingUrl: e.target.value })} placeholder="https://staging.domain.com" />
                    </div>
                    <div>
                      <label className="form-label">Production Endpoint</label>
                      <input className="form-input" value={form.productionUrl} onChange={(e) => setForm({ ...form, productionUrl: e.target.value })} placeholder="https://domain.com" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4" style={{ borderColor: "#f0f0f5" }}>
                <label className="form-label">Assign Team Members</label>
                <div className="grid grid-cols-2 gap-2 mt-2 p-3 rounded-xl border" style={{ borderColor: "#f0f0f5" }}>
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
                      <span className="text-xs font-medium group-hover:text-[#0D1B3E]" style={{ color: "#6b7280" }}>{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg border text-sm font-medium" style={{ borderColor: "#e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50" style={{ background: "#0D1B3E" }}>
                {saving ? "Saving..." : editing ? "Update" : "Add Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Create Project Modal */}
      <CreateProjectModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Delegate Modal */}
      {delegateProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "white" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "#0D1B3E", fontFamily: "var(--font-playfair)" }}>Delegate Task</h2>
              <button onClick={() => setDelegateProject(null)} className="text-gray-400 hover:text-gray-600 text-xl"><X className="inline-block w-4 h-4 shrink-0 mr-1" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label">Task Title *</label>
                <input 
                  className="form-input" 
                  value={delegateForm.title} 
                  onChange={(e) => setDelegateForm({ ...delegateForm, title: e.target.value })} 
                  placeholder="e.g. Design Homepage UI" 
                />
              </div>
              <div>
                <label className="form-label">Task Type *</label>
                <select 
                  className="form-input mb-4"
                  value={delegateForm.taskType}
                  onChange={(e) => setDelegateForm({ ...delegateForm, taskType: e.target.value as SystemTaskType })}
                >
                  <option value="project-task">Project Task</option>
                  {crmUser?.role === "admin" && <option value="meeting">Internal Meeting</option>}
                  {crmUser?.role === "admin" && <option value="follow-up">Follow-up</option>}
                  <option value="internal-task">Internal Task</option>
                </select>
              </div>
              <div>
                <label className="form-label">Assign To *</label>
                <select 
                  className="form-input" 
                  value={delegateForm.employeeId} 
                  onChange={(e) => setDelegateForm({ ...delegateForm, employeeId: e.target.value })}
                >
                  <option value="">Select team member...</option>
                  {members.map((m) => <option key={m.uid} value={m.uid}>{m.name} ({m.role})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Deadline</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={delegateForm.deadline} 
                  onChange={(e) => setDelegateForm({ ...delegateForm, deadline: e.target.value })} 
                />
              </div>
              <div>
                <label className="form-label">Task Instructions / Notes</label>
                <textarea 
                  className="form-input resize-none" 
                  rows={4} 
                  value={delegateForm.instructions} 
                  onChange={(e) => setDelegateForm({ ...delegateForm, instructions: e.target.value })} 
                  placeholder="Provide specific directions, scope constraints, and expectations..." 
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDelegateProject(null)} className="flex-1 py-2.5 rounded-lg border text-sm font-medium" style={{ borderColor: "#e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={handleDelegateTask} disabled={delegating} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50" style={{ background: "#C9A84C", color: "#0D1B3E" }}>
                {delegating ? "Assigning..." : "Assign Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delegate Modal */}
      {delegateProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "white" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "#0D1B3E", fontFamily: "var(--font-playfair)" }}>Delegate Task</h2>
              <button onClick={() => setDelegateProject(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="form-label">Task Title *</label>
                <input 
                  className="form-input" 
                  value={delegateForm.title} 
                  onChange={(e) => setDelegateForm({ ...delegateForm, title: e.target.value })} 
                  placeholder="e.g. Design Homepage UI" 
                />
              </div>
              <div>
                <label className="form-label">Task Type *</label>
                <select 
                  className="form-input mb-4"
                  value={delegateForm.taskType}
                  onChange={(e) => setDelegateForm({ ...delegateForm, taskType: e.target.value as SystemTaskType })}
                >
                  <option value="project-task">Project Task</option>
                  <option value="meeting">Internal Meeting</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="internal-task">Internal Task</option>
                </select>
              </div>
              <div>
                <label className="form-label">Assign To *</label>
                <select 
                  className="form-input" 
                  value={delegateForm.employeeId} 
                  onChange={(e) => setDelegateForm({ ...delegateForm, employeeId: e.target.value })}
                >
                  <option value="">Select team member...</option>
                  {members.map((m) => <option key={m.uid} value={m.uid}>{m.name} ({m.role})</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Deadline</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={delegateForm.deadline} 
                  onChange={(e) => setDelegateForm({ ...delegateForm, deadline: e.target.value })} 
                />
              </div>
              <div>
                <label className="form-label">Task Instructions / Notes</label>
                <textarea 
                  className="form-input resize-none" 
                  rows={4} 
                  value={delegateForm.instructions} 
                  onChange={(e) => setDelegateForm({ ...delegateForm, instructions: e.target.value })} 
                  placeholder="Provide specific directions, scope constraints, and expectations..." 
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDelegateProject(null)} className="flex-1 py-2.5 rounded-lg border text-sm font-medium" style={{ borderColor: "#e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={handleDelegateTask} disabled={delegating} className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50" style={{ background: "#C9A84C", color: "#0D1B3E" }}>
                {delegating ? "Assigning..." : "Assign Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .form-label { display: block; font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px; }
        .form-input { width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 13px; color: #1a1a2e; outline: none; transition: border-color 0.15s; background: white; font-family: var(--font-poppins); }
        .form-input:focus { border-color: #C9A84C; }
        .project-panel {
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
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
}
