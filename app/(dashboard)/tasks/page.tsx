"use client";
import { X, Handshake, Calendar, Pencil, Settings, Zap, Hammer, AlarmClock, Trash2 } from "lucide-react";


import { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Task, TaskPriority, SystemTaskType } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { PipelineService } from "@/lib/pipeline-service";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const PRIORITIES = [
  { key: "high",   label: "High",   color: "#991b1b", bg: "#fee2e2", border: "#fecaca" },
  { key: "medium", label: "Medium", color: "#92400e", bg: "#fef3c7", border: "#fde68a" },
  { key: "low",    label: "Low",    color: "#065f46", bg: "#d1fae5", border: "#a7f3d0" },
];

const TASK_STATUSES = [
  { key: "not-started", label: "To Do", color: "#6b7280", bg: "#f3f4f6" },
  { key: "in-progress", label: "In Progress", color: "#1d4ed8", bg: "#eff6ff" },
  { key: "completed",   label: "Completed",   color: "#065f46", bg: "#d1fae5" },
];

const TASK_TYPES = [
  { key: "follow-up", label: "Follow-up", icon: <AlarmClock className="inline-block w-4 h-4 shrink-0 mr-1" />, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { key: "meeting", label: "Meeting", icon: <Handshake className="inline-block w-4 h-4 shrink-0 mr-1" />, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  { key: "internal-task", label: "Internal Task", icon: <Zap className="inline-block w-4 h-4 shrink-0 mr-1" />, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  { key: "admin-action", label: "Admin Action", icon: <Settings className="inline-block w-4 h-4 shrink-0 mr-1" />, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
  { key: "project-task", label: "Project Task", icon: <Hammer className="inline-block w-4 h-4 shrink-0 mr-1" />, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" },
];

const EMPTY_FORM = {
  title: "", description: "", assignedTo: "", assignedToName: "",
  clientId: "", clientName: "", dueDate: "", time: "",
  priority: "medium" as TaskPriority,
  status: "not-started",
  taskType: "admin-action" as SystemTaskType,
  relatedTo: "",
  relatedType: "" as "project" | "lead" | "client" | "",
};

export default function TasksPage() {
  const { crmUser } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);



  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"my-desk" | "team">("my-desk");

  useEffect(() => {
    if (!crmUser) return;
    const tasksRef = collection(db, "tasks");
    const tasksQuery = crmUser.role === "employee" || viewMode === "my-desk"
      ? query(tasksRef, where("assignedTo", "==", crmUser.uid))
      : query(tasksRef);

    setTasks([]); // Clear tasks when switching view modes
    setLoading(true);

    const unsubTasks = onSnapshot(tasksQuery, snap => {
      setTasks(prev => {
        let next = [...prev];
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            if (!next.find(t => t.id === change.doc.id)) next.push({ id: change.doc.id, ...change.doc.data() });
          }
          if (change.type === "modified") {
            const index = next.findIndex(t => t.id === change.doc.id);
            if (index !== -1) next[index] = { id: change.doc.id, ...change.doc.data() };
            else next.push({ id: change.doc.id, ...change.doc.data() });
          }
          if (change.type === "removed") next = next.filter(t => t.id !== change.doc.id);
        });
        return next.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      });
      setLoading(false);
    });
    const unsubUsers = onSnapshot(collection(db, "users"), snap => setMembers(snap.docs.map(d => ({ uid: d.id, id: d.id, ...d.data() }))));
    const unsubClients = onSnapshot(query(collection(db, "clients"), where("active", "!=", false)), snap => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingClients(false);
    });
    const unsubProjects = onSnapshot(collection(db, "projects"), snap => setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubTasks(); unsubUsers(); unsubClients(); unsubProjects(); };
  }, [crmUser, viewMode]);

  function openAdd() { setEditing(null); setForm({ ...EMPTY_FORM, assignedTo: crmUser?.uid ?? "" }); setShowModal(true); }
  
  function openEdit(t: any) {
    setEditing(t);
    setForm({ 
      title: t.title, description: t.description ?? "", assignedTo: t.assignedTo ?? "", 
      assignedToName: t.assignedToName ?? "", clientId: t.clientId ?? "", clientName: t.clientName ?? "", 
      dueDate: t.dueDate ?? "", time: t.time ?? "", priority: t.priority, status: t.status ?? "not-started", 
      taskType: t.taskType ?? "admin-action", relatedTo: t.relatedTo ?? "", relatedType: t.relatedType ?? ""
    });
    setShowModal(true);
  }

  async function quickCreateProject() {
    if (!form.clientId || !form.title) return alert("Please select a client and give the task a title first.");
    setCreatingProject(true);
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, "projects"), {
        title: form.title, clientName: form.clientName, clientId: form.clientId,
        status: "in-progress", service: "web-development", createdAt: now, updatedAt: now,
        assignedTo: form.assignedTo ? [form.assignedTo] : []
      });
      setForm(f => ({ ...f, relatedTo: docRef.id, relatedType: "project" }));
      alert("Project created and linked!");
    } catch (e) { console.error(e); alert("Failed to create project"); } 
    finally { setCreatingProject(false); }
  }

  async function handleSave() {
    if (!form.title) return;

    if (form.relatedTo && form.relatedType === "project") {
      const isDuplicate = tasks.some(
        t => t.relatedTo === form.relatedTo && 
             t.title.trim().toLowerCase() === form.title.trim().toLowerCase() && 
             (!editing || t.id !== editing?.id)
      );

      if (isDuplicate) {
        alert("WARNING: A task with this exact title already exists on this project. Please use a unique title or append a sequence index.");
        return;
      }
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const member = members.find((m) => m.uid === form.assignedTo);
      const payload = { ...form, assignedToName: member?.name ?? form.assignedToName, assignedBy: crmUser?.uid ?? "" };

      if (editing) {
        await updateDoc(doc(db, "tasks", editing.id), payload);
      } else {

        const newTaskRef = await addDoc(collection(db, "tasks"), {
          ...payload,
          progress: 0,
          done: false,
          createdAt: now,
        });

        // Create a notification for the assignee
        if (form.assignedTo && form.assignedTo !== crmUser?.uid) {
          await addDoc(collection(db, "notifications"), {
            userId: form.assignedTo,
            title: "New Task Assigned",
            message: `You have been assigned a new task: ${form.title}`,
            link: `/tasks/${newTaskRef.id}?tab=blueprints`,
            read: false,
            createdAt: now,
            type: "task-assigned"
          });
        }

        // Send task assignment email to employee only
        if (member?.email) {
          try {
            const projectName = form.relatedTo
              ? projects.find((p) => p.id === form.relatedTo)?.title || ""
              : "";

            const html = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>New Task Assigned</title>
              </head>

              <body style="
                margin: 0;
                padding: 0;
                background-color: #f5f6fa;
                font-family: Arial, Helvetica, sans-serif;
              ">

                <table
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    background-color: #f5f6fa;
                    padding: 52px 20px;
                  "
                >
                  <tr>
                    <td align="center">

                      <!-- Main Card -->
                      <table
                        width="750"
                        cellpadding="0"
                        cellspacing="0"
                        border="0"
                        style="
                          width: 750px;
                          max-width: 100%;
                          background-color: #ffffff;
                          border-radius: 16px;
                          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.07);
                        "
                      >

                        <!-- Header -->
                        <tr>
                          <td
                            align="center"
                            style="
                              padding-top: 38px;
                              padding-bottom: 128px;
                            "
                          >
                            <div style="
                              font-size: 30px;
                              line-height: 36px;
                              font-weight: 700;
                              color: #C9A84C;
                            ">
                              A&amp;M CRM
                            </div>
                          </td>
                        </tr>

                        <!-- Greeting -->
                        <tr>
                          <td style="
                            padding: 0 40px;
                          ">

                            <div style="
                              font-size: 20px;
                              line-height: 30px;
                              color: #20243A;
                              margin-bottom: 10px;
                            ">
                              Hi <strong>${member.name || "there"}</strong>,
                            </div>

                            <div style="
                              font-size: 18px;
                              line-height: 28px;
                              color: #70788A;
                              margin-bottom: 29px;
                            ">
                              A new task has been assigned to you in the CRM.
                            </div>

                          </td>
                        </tr>

                        <!-- Task Box -->
                        <tr>
                          <td style="
                            padding: 0 40px;
                          ">

                            <table
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                              border="0"
                              style="
                                background-color: #F7F8FB;
                                border-left: 5px solid #C9A84C;
                                border-radius: 0 12px 12px 0;
                              "
                            >
                              <tr>
                                <td style="
                                  padding: 27px 30px 30px 30px;
                                ">

                                  <!-- Task Title -->
                                  <div style="
                                    font-size: 25px;
                                    line-height: 32px;
                                    font-weight: 700;
                                    color: #17213F;
                                    margin-bottom: 5px;
                                  ">
                                    ${form.title}
                                  </div>

                                  <!-- Project -->
                                  ${
                                    projectName
                                      ? `
                                        <div style="
                                          font-size: 17px;
                                          line-height: 26px;
                                          color: #4F5668;
                                        ">
                                          <strong>Project:</strong> ${projectName}
                                        </div>
                                      `
                                      : ""
                                  }

                                </td>
                              </tr>
                            </table>

                          </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                          <td
                            align="center"
                            style="
                              padding: 48px 40px 52px 40px;
                            "
                          >
                            <div style="
                              font-size: 14px;
                              line-height: 20px;
                              color: #9AA2B3;
                            ">
                              The A&amp;M Internationals FZC
                              &nbsp;·&nbsp;
                              Elevating the World, Elegantly
                            </div>
                          </td>
                        </tr>

                      </table>

                    </td>
                  </tr>
                </table>

              </body>
              </html>
            `;

            const emailResponse = await fetch("/api/send-email", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: [member.email],
                subject: `CRM Task Assigned: ${form.title}`,
                html,
              }),
            });

            if (!emailResponse.ok) {
              const errorData = await emailResponse.text();
              console.error("Task assignment email failed:", errorData);
            } else {
              console.log(`Task assignment email sent to ${member.email}`);
            }
          } catch (emailError) {
            console.error("Task assignment email error:", emailError);
          }
        }
      }

      // Check if due date is tomorrow — send reminder
      if (form.dueDate && member?.email) {
        const due = new Date(form.dueDate);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (due.toDateString() === tomorrow.toDateString()) {
          try {
            await fetch("/api/send-email", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: [member.email],
                subject: `Task Due Tomorrow: ${form.title}`,
                html: `<div style="padding:20px;font-family:sans-serif;"><h3>Hi ${member.name},</h3><p>Reminder that your task <strong>"${form.title}"</strong> is due tomorrow (${form.dueDate}).</p></div>`,
              }),
            });
          } catch (e) {
            console.error("Reminder email error:", e);
          }
        }
      }
      setShowModal(false);
    } finally { setSaving(false); }
  }

  async function toggleDone(task: any) {
    if (crmUser?.role === "admin" && task.assignedTo !== crmUser?.uid) {
      alert("Action Restricted: Admins cannot update an employee's progress on their tasks.");
      return;
    }
    const newStatus = task.status === "completed" ? "in-progress" : "completed";
    await PipelineService.handleTaskStatusUpdate(task, newStatus, crmUser?.uid ?? "");
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    await deleteDoc(doc(db, "tasks", id));
  }

  async function updateStatus(task: any, status: string) {
    if (crmUser?.role === "admin" && task.assignedTo !== crmUser?.uid) {
      alert("Action Restricted: Admins cannot update an employee's progress on their tasks.");
      return;
    }
    await PipelineService.handleTaskStatusUpdate(task, status, crmUser?.uid ?? "");
  }

  const filteredTasks = tasks.filter(t => {
    if (viewMode === "team") {
      if (t.assignedTo === crmUser?.uid) return false;
      if (t.relatedType === "lead") return false; // Hide all lead follow-ups from team view
    }
    if (typeFilter !== "all" && t.taskType !== typeFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    
    // Hide tasks if their client is archived/inactive
    if (t.clientId && !loadingClients && !clients.some(c => c.id === t.clientId)) return false;

    return true;
  });

  const handleDrop = (e: React.DragEvent, statusKey: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== statusKey) {
      updateStatus(task, statusKey);
    }
  };

  const getColTasks = (statusKey: string) => {
    if (statusKey === "not-started") return filteredTasks.filter(t => !["in-progress", "dev", "test", "review", "completed", "done"].includes(t.status));
    if (statusKey === "in-progress") return filteredTasks.filter(t => ["in-progress", "dev", "test", "review"].includes(t.status));
    if (statusKey === "completed") return filteredTasks.filter(t => ["completed", "done"].includes(t.status));
    return [];
  };

  const pInfo = (key: string) => PRIORITIES.find(p => p.key === key) ?? PRIORITIES[1];
  const tInfo = (key: string) => TASK_TYPES.find(t => t.key === key) ?? TASK_TYPES.find(t => t.key === "admin-action")!;

  return (
    <div className="p-8 h-screen flex flex-col bg-[#f8fafc] overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 shrink-0">
        <div className="page-header mb-0 border-0 pb-0">
          <h1 className="page-title flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Operations Board
          </h1>
          <p className="text-sm text-slate-500 mt-1">{filteredTasks.length} active items • {viewMode === 'my-desk' ? 'Your Personal Desk' : 'Full Team Overview'}</p>
        </div>
        <div className="flex items-center gap-3">
          {crmUser?.role !== "employee" && (
            <div className="flex bg-slate-200 p-1 rounded-xl mr-2">
              <button onClick={() => setViewMode("my-desk")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "my-desk" ? "bg-white text-[#0D1B3E] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                My Desk
              </button>
              <button onClick={() => setViewMode("team")} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "team" ? "bg-white text-[#0D1B3E] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                Team View
              </button>
            </div>
          )}
          <input 
            type="text" 
            placeholder="Search tasks..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#C9A84C] w-64 shadow-sm transition-all bg-white" 
          />
          {crmUser?.role !== "employee" && (
            <button onClick={openAdd} className="bg-[#0D1B3E] hover:bg-[#1a2b5e] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2">
              <span>+</span> New Action
            </button>
          )}
        </div>
      </div>

      {/* Clean Filters */}
      <div className="flex flex-wrap gap-4 mb-4 shrink-0 bg-white p-3 rounded-xl shadow-sm border border-slate-200 items-center">
        <select 
          className="form-input w-48 text-sm" 
          value={typeFilter} 
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="all">All Task Types</option>
          {TASK_TYPES.filter(tt => crmUser?.role === "admin" || (tt.key !== "follow-up" && tt.key !== "meeting")).map(tt => (
            <option key={tt.key} value={tt.key}>{tt.icon} {tt.label}</option>
          ))}
        </select>
        <select 
          className="form-input w-48 text-sm" 
          value={priorityFilter} 
          onChange={e => setPriorityFilter(e.target.value)}
        >
          <option value="all">All Priorities</option>
          {PRIORITIES.map(p => (
            <option key={p.key} value={p.key}>{p.label} Priority</option>
          ))}
        </select>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 min-h-0">
        {TASK_STATUSES.map(col => {
          const colTasks = getColTasks(col.key);
          return (
            <div 
              key={col.key} 
              className="flex-1 min-w-[320px] max-w-[400px] flex flex-col bg-slate-50/50 rounded-3xl border border-slate-200 overflow-hidden"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-sm flex justify-between items-center shrink-0">
                <h3 className="font-black text-slate-700 uppercase tracking-widest text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  {col.label}
                </h3>
                <span className="bg-white border border-slate-200 text-slate-500 text-xs font-bold px-2 py-0.5 rounded-full">{colTasks.length}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                  [1,2].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-slate-100" />)
                ) : colTasks.length === 0 ? (
                  <div className="text-center py-10 text-sm font-medium text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">Drop tasks here</div>
                ) : (
                  <AnimatePresence>
                    {colTasks.map(task => {
                      const prio = pInfo(task.priority);
                      const tType = tInfo(task.taskType || "admin-action");
                      const isOverdue = task.dueDate && task.status !== "completed" && new Date(task.dueDate) < new Date();
                      
                      return (
                        <motion.div 
                          layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                          key={task.id} 
                          draggable
                          onDragStart={(e: any) => e.dataTransfer.setData("taskId", task.id)}
                          onClick={(e) => {
                            if (task.relatedType === "lead") {
                              return; // No specific page for lead follow-ups
                            } else if (task.taskType === "system") {
                              router.push(`/projects/${task.relatedTo}`);
                            } else {
                              router.push(`/tasks/${task.id}`);
                            }
                          }}
                          className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md hover:border-[#C9A84C]/50 transition-all group relative overflow-hidden flex flex-col ${task.relatedType === 'lead' ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: prio.color }} />
                          
                          <div className="flex justify-between items-start mb-2 pl-2">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border flex items-center gap-1 ${tType.bg} ${tType.color} ${tType.border}`}>
                              {tType.icon} {tType.label}
                            </span>
                            <div className="flex items-center gap-1">
                              {isOverdue && <span className="bg-red-50 text-red-600 border border-red-100 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">Overdue</span>}
                              {crmUser?.role !== "employee" && (
                                <button onClick={(e) => { e.stopPropagation(); openEdit(task); }} className="w-5 h-5 rounded-md border border-slate-200 bg-white text-slate-400 flex items-center justify-center hover:bg-slate-50 hover:text-[#0D1B3E] transition-all" title="Edit Task details">
                                  <Pencil className="inline-block w-4 h-4 shrink-0 mr-1" />
                                </button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); toggleDone(task); }} className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${task.status === "completed" ? "bg-emerald-500 border-emerald-600 text-white" : "bg-slate-50 border-slate-200 text-transparent hover:border-emerald-400 hover:text-emerald-200"}`}>
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4L3.5 6.5L9 1"/></svg>
                              </button>
                            </div>
                          </div>

                          <h4 className="font-bold text-slate-800 text-sm mb-2 pl-2 leading-tight group-hover:text-[#0D1B3E] transition-colors" style={{ textDecoration: task.status === "completed" ? "line-through" : "none", opacity: task.status === "completed" ? 0.6 : 1 }}>
                            {task.title}
                          </h4>

                          <div className="pl-2 mb-3 space-y-1">
                            {task.relatedType === "project" && task.relatedTo && (
                              <div className="text-[11px] font-bold text-[#C9A84C] flex items-center gap-1">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                                <span className="truncate">{projects.find(p => p.id === task.relatedTo)?.title || "Unknown Project"}</span>
                              </div>
                            )}
                            {task.clientName && (
                              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                <span className="truncate">{task.clientName}</span>
                              </div>
                            )}
                          </div>

                          <div className="pl-2 mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-1.5" title={task.assignedToName}>
                              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black border border-indigo-200">
                                {task.assignedToName ? task.assignedToName.charAt(0) : "?"}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {task.dueDate && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${isOverdue ? "text-red-600 bg-red-50" : "text-slate-500 bg-slate-50"}`}>
                                  <Calendar className="inline-block w-4 h-4 shrink-0 mr-1" /> {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} {task.time ? `at ${task.time}` : ""}
                                </span>
                              )}
                              <select
                                onClick={e => e.stopPropagation()}
                                onChange={e => { e.stopPropagation(); updateStatus(task, e.target.value); }}
                                value={col.key}
                                className="text-[10px] font-bold uppercase border-none bg-transparent text-slate-400 cursor-pointer outline-none hover:text-[#0D1B3E]"
                              >
                                {TASK_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                              </select>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-black text-[#0D1B3E]">{editing ? "Edit Operation Task" : "New Operation Task"}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"><X className="inline-block w-4 h-4 shrink-0 mr-1" /></button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Task Type</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {TASK_TYPES.filter(tt => crmUser?.role === "admin" || (tt.key !== "follow-up" && tt.key !== "meeting")).map(tt => (
                    <button
                      key={tt.key}
                      onClick={() => setForm({ ...form, taskType: tt.key as SystemTaskType })}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${form.taskType === tt.key ? "border-[#C9A84C] bg-[#C9A84C]/5 shadow-sm" : "border-slate-100 hover:border-slate-200 bg-white"}`}
                    >
                      <span className="text-xl mb-1">{tt.icon}</span>
                      <span className={`text-[10px] font-black uppercase text-center ${form.taskType === tt.key ? "text-[#0D1B3E]" : "text-slate-400"}`}>{tt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Title *</label>
                <input className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-800 outline-none focus:border-[#C9A84C] transition-colors" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="E.g., Call client regarding proposal..." />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
                <textarea className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-800 outline-none focus:border-[#C9A84C] transition-colors resize-none" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Add detailed notes or context..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Client Link</label>
                  <select disabled={crmUser?.role === "employee"} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-800 outline-none focus:border-[#C9A84C] transition-colors disabled:bg-slate-50 disabled:text-slate-500" value={form.clientId} onChange={e => { const c = clients.find(x => x.id === e.target.value); setForm({ ...form, clientId: e.target.value, clientName: c?.company ?? c?.name ?? "" }); }}>
                    <option value="">No Client Linked</option>
                    {clients.filter(c => c.active !== false).map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Project Link (Optional)</label>
                  <select disabled={crmUser?.role === "employee"} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-800 outline-none focus:border-[#C9A84C] transition-colors disabled:bg-slate-50 disabled:text-slate-500" value={form.relatedTo} onChange={e => setForm({ ...form, relatedTo: e.target.value, relatedType: e.target.value ? "project" : "" })}>
                    <option value="">No Project Linked</option>
                    {projects.filter(p => p.status !== "completed").map(p => <option key={p.id} value={p.id}>[{p.clientName}] {p.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Owner</label>
                  <select disabled={crmUser?.role === "employee"} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-800 outline-none focus:border-[#C9A84C] transition-colors disabled:bg-slate-50 disabled:text-slate-500" value={form.assignedTo} onChange={e => { const m = members.find(x => x.uid === e.target.value); setForm({ ...form, assignedTo: e.target.value, assignedToName: m?.name ?? "" }); }}>
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
                  <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-800 outline-none focus:border-[#C9A84C] transition-colors" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as TaskPriority })}>
                    {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Due Date</label>
                    <input className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-800 outline-none focus:border-[#C9A84C] transition-colors" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Time</label>
                    <input className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-800 outline-none focus:border-[#C9A84C] transition-colors" type="time" value={form.time || ""} onChange={e => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex gap-4 items-center">
                {editing && crmUser?.role !== "employee" ? (
                  <button onClick={() => { deleteTask(editing.id); setShowModal(false); }} className="text-xs font-bold flex items-center text-red-500 hover:text-red-700 hover:underline"><Trash2 className="inline-block w-3.5 h-3.5 shrink-0 mr-1" /> Delete Task</button>
                ) : <div/>}
                {form.taskType === "meeting" && (() => {
                  let timeParams = "";
                  if (form.dueDate && form.time) {
                    const startDate = new Date(`${form.dueDate}T${form.time}`);
                    if (!isNaN(startDate.getTime())) {
                      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
                      timeParams = `&startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}`;
                    }
                  }
                  return (
                  <a 
                    href={`https://teams.microsoft.com/l/meeting/new?subject=${encodeURIComponent(form.title || "New Meeting")}&content=${encodeURIComponent(form.description || "Meeting notes")}${form.clientId ? `&attendees=${clients.find(c => c.id === form.clientId)?.email || ""}` : ""}${timeParams}`}
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs font-bold text-[#6264A7] hover:bg-[#6264A7]/10 transition-colors flex items-center gap-1.5 border border-[#6264A7]/30 px-3 py-1.5 rounded-lg"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.5 10.5V18C22.5 19.2 21.5 20.2 20.2 20.2H16.5V12L22.5 10.5ZM16.5 12V3.8C16.5 2.5 15.5 1.5 14.2 1.5H3.8C2.5 1.5 1.5 2.5 1.5 3.8V18C1.5 19.2 2.5 20.2 3.8 20.2H14.2C15.5 20.2 16.5 19.2 16.5 18V12Z"/></svg>
                    Schedule in Teams
                  </a>
                  );
                })()}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving || !form.title} className="bg-[#C9A84C] hover:bg-[#b0923e] text-white px-8 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50">
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
