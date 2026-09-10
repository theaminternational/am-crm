"use client";
import { X, Trash2, ClipboardList, Search, Mail, Building2, DollarSign, Pencil, User, Bell } from "lucide-react";


import { useEffect, useState, useRef } from "react";
import { doc, getDoc, collection, getDocs, query, where, orderBy, updateDoc, onSnapshot, deleteDoc, addDoc, arrayUnion, arrayRemove, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Project, ProjectTask, ServiceTag, ProjectStatus, SystemTaskType } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { toast } from "@/components/ui/toast";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PipelineService } from "@/lib/pipeline-service";

const STATUSES: { key: ProjectStatus; label: string; color: string; bg: string }[] = [
  { key: "not-started", label: "Not Started", color: "#6b7280", bg: "#f9fafb" },
  { key: "in-progress", label: "In Progress", color: "#1d4ed8", bg: "#eff6ff" },
  { key: "review",      label: "In Review",   color: "#b35a00", bg: "#fff7ed" },
  { key: "completed",   label: "Completed",   color: "#15803d", bg: "#f0fdf4" },
  { key: "on-hold",     label: "On Hold",     color: "#b91c1c", bg: "#fef2f2" },
];

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { crmUser } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [projectTasks, setProjectTasks] = useState<any[]>([]);
  const isDelegatingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "files" | "payments">("overview");
  const [assetName, setAssetName] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [assetCategory, setAssetCategory] = useState("Documentation");
  const [addingFile, setAddingFile] = useState(false);

  // Payment Log State
  const [paymentForm, setPaymentForm] = useState({ amount: "", date: new Date().toISOString().split('T')[0], method: "Bank Transfer", notes: "" });
  const [loggingPayment, setLoggingPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  // Edit Financials State
  const [showFinancialsModal, setShowFinancialsModal] = useState(false);
  const [finForm, setFinForm] = useState({ budget: "", due: "", paid: "", remaining: "" });
  const [savingFin, setSavingFin] = useState(false);

  // Reminder State
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderBody, setReminderBody] = useState("");
  const [sendingReminder, setSendingReminder] = useState(false);

  // Dynamic Overview State
  const [editingBlueprint, setEditingBlueprint] = useState(false);
  const [blueprintValue, setBlueprintValue] = useState("");
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsValue, setInstructionsValue] = useState("");
  // Technical Hub State
  const [editingTechHub, setEditingTechHub] = useState(false);
  const [techHubForm, setTechHubForm] = useState({
    figmaUrl: "",
    repoUrl: "",
    stagingUrl: "",
    productionUrl: "",
    techStack: [] as string[],
    coreFocus: "Dynamic Web App",
  });

  // Task Delegation State
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [delegateForm, setDelegateForm] = useState({
    employeeId: "",
    title: "",
    instructions: "",
    taskType: "project-task" as SystemTaskType,
    dueDate: "",
    time: "",
  });
  const [delegating, setDelegating] = useState(false);
  const [selectedDrawerTask, setSelectedDrawerTask] = useState<any | null>(null);
  const [logInputText, setLogInputText] = useState("");
  const [duplicateConflictTask, setDuplicateConflictTask] = useState<any | null>(null);
  const [duplicateInstructionNote, setDuplicateInstructionNote] = useState("");

  // Add Note Modal State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteModalTask, setNoteModalTask] = useState<any | null>(null);
  const [noteModalText, setNoteModalText] = useState("");

  // Dynamic Tech Hub State
  const [newTechTag, setNewTechTag] = useState("");
  const [editingCoreFocus, setEditingCoreFocus] = useState(false);
  const [tempCoreFocus, setTempCoreFocus] = useState("");
  const router = useRouter();

  // File Category State
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<"All" | "Design" | "Development" | "Documentation" | "Credentials">("All");

  const [addingField, setAddingField] = useState(false);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldValue, setFieldValue] = useState("");

  const [addingMilestone, setAddingMilestone] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");

  async function fetchProject() {
    const [pSnap, uSnap] = await Promise.all([
      getDoc(doc(db, "projects", id)),
      getDocs(collection(db, "users"))
    ]);

    if (pSnap.exists()) {
      let pData = pSnap.data() as any;
      if (crmUser && crmUser.role !== "admin") {
        delete pData.budget;
        delete pData.contractValue;
        delete pData.pipelineValue;
        delete pData.due;
        delete pData.paid;
        delete pData.remaining;
        delete pData.balance;
        delete pData.payments;
      }
      setProject({ id: pSnap.id, ...pData } as Project);
      setTechHubForm({
        figmaUrl: pData.figmaUrl ?? "",
        repoUrl: pData.repoUrl ?? "",
        stagingUrl: pData.stagingUrl ?? "",
        productionUrl: pData.productionUrl ?? "",
        techStack: pData.techStack || [],
        coreFocus: pData.coreFocus ?? "Dynamic Web App",
      });
    }
    setUsers(uSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => { 
    fetchProject(); 
    
    const qTasks = query(collection(db, "tasks"), where("relatedTo", "==", id));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const rawTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const seen = new Set();
      const deduped: any[] = [];
      const ghosts: string[] = [];
      
      rawTasks.forEach((t: any) => {
        const titleKey = (t.title || "").trim().toLowerCase();
        if (seen.has(titleKey)) {
          ghosts.push(t.id);
        } else {
          seen.add(titleKey);
          deduped.push(t);
        }
      });
      
      setProjectTasks(deduped);
      
      // Auto-heal: Silently assassinate database ghosts in the background
      ghosts.forEach(async (ghostId) => {
        try { await deleteDoc(doc(db, "tasks", ghostId)); } catch(e){}
      });
    });
    
    return () => unsubTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, crmUser]);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("delegate") === "true") {
      setShowDelegateModal(true);
      setActiveTab("tasks");
    }
  }, [searchParams]);

  async function addAsset() {
    if (!assetName.trim() || !assetUrl.trim() || !project) return;
    setAddingFile(true);
    try {
      const fileObj = {
        name: assetName.trim(),
        url: assetUrl.trim(),
        category: assetCategory,
        addedBy: crmUser?.name || "Admin",
        at: new Date().toISOString()
      };
      const updatedFiles = [...(project as any).sharedFiles || [], fileObj];
      await updateDoc(doc(db, "projects", project.id), { sharedFiles: updatedFiles });
      setProject({ ...project, sharedFiles: updatedFiles } as any);
      setAssetName("");
      setAssetUrl("");
    } catch (e) {
      console.error(e);
      alert("Failed to add asset");
    } finally {
      setAddingFile(false);
    }
  }

  async function deleteFile(index: number) {
    if (!project || !confirm("Remove this shared file?")) return;
    try {
      const currentFiles = [...(project as any).sharedFiles || []];
      currentFiles.splice(index, 1);
      await updateDoc(doc(db, "projects", project.id), { sharedFiles: currentFiles });
      setProject({ ...project, sharedFiles: currentFiles } as any);
    } catch (e) {
      console.error(e);
      alert("Failed to delete file");
    }
  }

  async function logPayment() {
    if (!project || !paymentForm.amount) return;
    setLoggingPayment(true);
    try {
      const amountNum = Number(paymentForm.amount);
      let updatedPayments = [...(project.payments || [])];
      
      if (editingPaymentId) {
        // Edit existing payment
        updatedPayments = updatedPayments.map(p => 
          p.id === editingPaymentId 
            ? { ...p, amount: amountNum, date: paymentForm.date, method: paymentForm.method, notes: paymentForm.notes } 
            : p
        );
      } else {
        // Add new payment
        const newPayment = {
          id: Math.random().toString(36).substr(2, 9),
          amount: amountNum,
          date: paymentForm.date,
          method: paymentForm.method,
          notes: paymentForm.notes,
          loggedBy: crmUser?.name || "System"
        };
        updatedPayments.push(newPayment);
      }

      // Auto-calculate new balance
      const basePaid = project.paid ?? 0;
      const loggedPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const totalPaid = basePaid + loggedPaid;
      const newRemaining = (project.budget ?? 0) - totalPaid;

      await updateDoc(doc(db, "projects", project.id), { 
        payments: updatedPayments,
        remaining: newRemaining,
        updatedAt: new Date().toISOString()
      });

      setProject({ ...project, payments: updatedPayments, remaining: newRemaining });
      setPaymentForm({ amount: "", date: new Date().toISOString().split('T')[0], method: "Bank Transfer", notes: "" });
      setShowPaymentModal(false);
      setEditingPaymentId(null);
    } catch (e) {
      console.error(e);
      alert("Failed to log payment");
    } finally {
      setLoggingPayment(false);
    }
  }

  async function handleGenerateInvoice() {
    if (!project) return;
    if (!confirm("Are you sure you want to generate a draft invoice for this project?")) return;
    
    setLoggingPayment(true);
    try {
      const batch = writeBatch(db);
      await PipelineService.draftInvoiceForProject(project.id, crmUser?.uid || "", batch);
      await batch.commit();
      
      alert("Invoice drafted successfully! Redirecting...");
      router.push("/invoice");
    } catch (e: any) {
      alert("Failed to generate invoice: " + e.message);
    } finally {
      setLoggingPayment(false);
    }
  }

  async function deletePayment(paymentId: string) {
    if (!project || !confirm("Are you sure you want to delete this payment record? This will alter the total paid amount and remaining balance.")) return;
    try {
      const updatedPayments = (project.payments || []).filter(p => p.id !== paymentId);
      
      // Auto-calculate new balance
      const basePaid = project.paid ?? 0;
      const loggedPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const totalPaid = basePaid + loggedPaid;
      const newRemaining = (project.budget ?? 0) - totalPaid;

      await updateDoc(doc(db, "projects", project.id), { 
        payments: updatedPayments,
        remaining: newRemaining,
        updatedAt: new Date().toISOString()
      });

      setProject({ ...project, payments: updatedPayments, remaining: newRemaining });
    } catch (e) {
      console.error(e);
      alert("Failed to delete payment.");
    }
  }

  function openEditFinancials() {
    if (!project) return;
    setFinForm({
      budget: project.budget?.toString() || "",
      due: project.due?.toString() || "",
      paid: project.paid?.toString() || "",
      remaining: project.remaining?.toString() || ""
    });
    setShowFinancialsModal(true);
  }

  async function saveFinancials() {
    if (!project) return;
    setSavingFin(true);
    try {
      const b = Number(finForm.budget) || 0;
      const d = Number(finForm.due) || 0;
      const p = Number(finForm.paid) || 0;
      const r = Number(finForm.remaining) || 0;

      await updateDoc(doc(db, "projects", project.id), {
        budget: b,
        due: d,
        paid: p,
        remaining: r,
        updatedAt: new Date().toISOString()
      });
      setProject({ ...project, budget: b, due: d, paid: p, remaining: r });
      setShowFinancialsModal(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save financials");
    } finally {
      setSavingFin(false);
    }
  }

  function openReminder() {
    const defaultText = `Dear ${project?.clientName || "Client"},\n\nWe hope this message finds you well.\n\nWe are writing to gently remind you that there is a pending balance of ${project?.currency || "AED"} ${project?.due?.toLocaleString() || "0"} on your account for the "${project?.title}" project. We understand that oversights happen, and we would greatly appreciate it if you could process this payment at your earliest convenience.\n\nIf you have already processed the payment, please kindly disregard this message.\n\nThank you for your continued partnership and trust in us.\n\nWarm regards,\nA&M Internationals Team`;
    setReminderBody(defaultText);
    setShowReminderModal(true);
  }

  async function sendReminder() {
    setSendingReminder(true);
    try {
      // In a real production environment, this would call an API route to send an email.
      // For the internal operations hub, we log the sent reminder as an operation.
      const now = new Date().toISOString();
      await addDoc(collection(db, "tasks"), {
        title: "Payment Reminder Sent",
        description: reminderBody,
        assignedTo: crmUser?.uid || "system",
        assignedToName: crmUser?.name || "System",
        assignedBy: crmUser?.uid || "System",
        clientId: project?.clientId || "",
        clientName: project?.clientName || "",
        relatedTo: project?.id || "",
        relatedType: "project",
        priority: "medium",
        status: "completed",
        done: true,
        taskType: "admin-action",
        createdAt: now,
        updatedAt: now
      });
      
      alert("Reminder logged to operations successfully!");
      setShowReminderModal(false);
    } catch (e) {
      console.error(e);
      alert("Failed to log reminder.");
    } finally {
      setSendingReminder(false);
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  async function saveTechnicalHub() {
    if (!project) return;
    try {
      await updateDoc(doc(db, "projects", project.id), techHubForm);
      setProject({ ...project, ...techHubForm });
      setEditingTechHub(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save Technical Infrastructure Hub");
    }
  }

  async function delegateTask() {
    if (isDelegatingRef.current) return;
    if (!project || !delegateForm.employeeId || !delegateForm.title) {
      alert("Please specify both an employee and a task title.");
      return;
    }

    // DUPLICATE TITLE INTERCEPTOR
    const titleCollision = projectTasks.find(
      t => t.relatedTo === project.id && t.title.trim().toLowerCase() === delegateForm.title.trim().toLowerCase()
    );

    if (titleCollision) {
      alert("WARNING: A task with this exact title already exists on this project. Please append a sequence index (e.g., V2, Part 2) to ensure separate communication history sheets.");
      return;
    }

    isDelegatingRef.current = true;
    setDelegating(true);
    try {
      const now = new Date().toISOString();
      const employee = users.find(u => u.uid === delegateForm.employeeId);
      
      const payload = {
        title: delegateForm.title,
        description: delegateForm.instructions || `Task for project: ${project.title}`,
        assignedTo: delegateForm.employeeId,
        assignedToName: employee?.name || "Team Member",
        assignedBy: crmUser?.uid || "System",
        clientId: project.clientId || "",
        clientName: project.clientName || "",
        relatedTo: project.id,
        relatedType: "project",
        priority: "medium",
        status: "not-started",
        done: false,
        createdAt: now,
        dueDate: delegateForm.dueDate || project.deadline || now,
        time: delegateForm.time || "",
        // Documentation cascade fields:
        masterBlueprint: project.masterBlueprint || "",
        leadInstructions: project.leadInstructions || "",
        taskInstructions: delegateForm.instructions || "",
        taskType: delegateForm.taskType
      };

      const docRef = await addDoc(collection(db, "tasks"), payload);
      
      await addDoc(collection(db, "notifications"), {
        userId: delegateForm.employeeId,
        title: "Task Assigned",
        message: `You were assigned a new task: ${delegateForm.title}`,
        link: `/tasks/${docRef.id}?tab=blueprints`,
        read: false,
        createdAt: new Date().toISOString(),
        type: "task-assigned"
      });
      
      // SEND EMAIL NOTIFICATION TO ASSIGNEE
      if (employee?.email) {
        try {
          const dueDateTime = `${delegateForm.dueDate} ${delegateForm.time}`.trim();
          const html = `
            <div style="background:#f8f9fc;padding:40px 20px;font-family:Arial,sans-serif;">
              <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
                <div style="background:var(--navy);padding:32px;text-align:center;">
                  <h1 style="color:#C9A84C;margin:0;font-size:24px;letter-spacing:1px;">A&M CRM</h1>
                  <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px;">Task Assigned</p>
                </div>
                <div style="padding:32px;">
                  <p style="color:#1a1a2e;font-size:16px;margin-bottom:12px;">Hi <strong>${employee.name}</strong>,</p>
                  <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">A new task has been assigned to you in the CRM.</p>

                  <div style="background:#f8f9fc;border-left:4px solid #C9A84C;padding:24px;border-radius:0 8px 8px 0;">
                    <h3 style="color:#0D1B3E;margin:0 0 8px;font-size:18px;">${delegateForm.title}</h3>
                    <p style="color:#4b5563;font-size:13px;margin:4px 0;"><strong>Project:</strong> ${project.title}</p>
                    ${dueDateTime ? `<p style="color:#4b5563;font-size:13px;margin:4px 0;"><strong>Due:</strong> ${dueDateTime}</p>` : ""}
                    ${delegateForm.instructions ? `<p style="color:#4b5563;font-size:13px;margin:12px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;"><strong>Instructions:</strong> ${delegateForm.instructions}</p>` : ""}
                  </div>
                  
                  <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:40px;">The A&M Internationals FZC · Elevating the World, Elegantly</p>
                </div>
              </div>
            </div>
          `;

          await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: [employee.email, "am@theaminternational.com"],
              subject: `CRM Task Assigned: ${delegateForm.title}`,
              html
            })
          });
        } catch (e) {
          console.error("Failed to send assignment email", e);
        }
      }

      setShowDelegateModal(false);
      setDelegateForm({ employeeId: "", title: "", instructions: "", taskType: "project-task" as SystemTaskType, dueDate: "", time: "" });
      alert("Task successfully delegated and assigned!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to delegate task:" + (err.message || String(err)));
    } finally {
      isDelegatingRef.current = false;
      setDelegating(false);
    }
  }

  // --- INLINE TASK COMMAND RUNWAY HELPERS ---
  const milestoneSteps = [
    { key: "not-started", label: "START" },
    { key: "dev", label: "DEV" },
    { key: "test", label: "TEST" },
    { key: "review", label: "REVIEW" },
    { key: "completed", label: "DONE" },
  ];

  const getMilestoneIndex = (status: string) => {
    switch (status) {
      case "not-started": return 0;
      case "dev": case "in-progress": return 1;
      case "test": return 2;
      case "review": return 3;
      case "completed": case "done": return 4;
      default: return 0;
    }
  };

  async function updateTaskStatus(task: any, status: string) {
    if (crmUser?.role === "admin" && task.assignedTo !== crmUser?.uid) {
      alert("Action Restricted: Admins cannot update an employee's progress on their tasks.");
      return;
    }
    try {
      await PipelineService.handleTaskStatusUpdate(task, status, crmUser?.uid ?? "");
      
      const isCompleted = status === "completed" || status === "done";
      const dbStatus = status === "done" ? "completed" : status;
      
      if (selectedDrawerTask && selectedDrawerTask.id === task.id) {
        setSelectedDrawerTask({ ...selectedDrawerTask, status: dbStatus, done: isCompleted });
      }
      
      // Auto-refresh project to get the latest status if it was changed by PipelineService
      fetchProject();
    } catch (e) {
      console.error(e);
      toast("Failed to update status", "error");
    }
  }

  async function commitLogEntry() {
    if (!selectedDrawerTask || !logInputText.trim()) return;
    try {
      const newLog = {
        id: Math.random().toString(36).substr(2, 9),
        text: logInputText,
        timestamp: new Date().toISOString(),
        authorName: crmUser?.name || "Team Member",
        authorUid: crmUser?.uid || ""
      };
      const updatedLogs = [...(selectedDrawerTask.logs || []), newLog];
      
      await updateDoc(doc(db, "tasks", selectedDrawerTask.id), { logs: updatedLogs });
      
      setSelectedDrawerTask({ ...selectedDrawerTask, logs: updatedLogs });
      setLogInputText("");
      toast("Log committed successfully!", "success");
    } catch (err: any) {
      console.error(err);
      toast("Failed to commit log entry:" + (err.message || String(err)), "error");
    }
  }

  async function updateTaskInstructions(task: any, instructions: string) {
    try {
      await updateDoc(doc(db, "tasks", task.id), { taskInstructions: instructions, description: instructions });
      if (selectedDrawerTask && selectedDrawerTask.id === task.id) {
        setSelectedDrawerTask({ ...selectedDrawerTask, taskInstructions: instructions, description: instructions });
      }
      toast("Instructions updated successfully!", "success");
    } catch (e) {
      console.error(e);
      toast("Failed to update instructions", "error");
    }
  }

  async function reallocateAsset(task: any, employeeId: string) {
    try {
      const employee = users.find(u => u.uid === employeeId);
      if (!employee) return;
      await updateDoc(doc(db, "tasks", task.id), { 
        assignedTo: employeeId, 
        assignedToName: employee.name 
      });
      if (selectedDrawerTask && selectedDrawerTask.id === task.id) {
        setSelectedDrawerTask({ ...selectedDrawerTask, assignedTo: employeeId, assignedToName: employee.name });
      }
      alert(`Asset reallocated to ${employee.name}`);
    } catch (e) {
      console.error(e);
      alert("Failed to reallocate asset");
    }
  }

  async function deleteTask(taskId: string) {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      toast("Task deleted successfully!", "success");
    } catch (e) {
      console.error(e);
      toast("Failed to delete task", "error");
    }
  }

  // --- DYNAMIC OVERVIEW HANDLERS ---
  async function saveBlueprint() {
    if (!project) return;
    if (crmUser?.role !== "admin") {
      alert("Only Administrators can modify the Master Blueprint.");
      return;
    }
    try {
      await updateDoc(doc(db, "projects", project.id), { masterBlueprint: blueprintValue });
      setProject({ ...project, masterBlueprint: blueprintValue });
      setEditingBlueprint(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save master blueprint");
    }
  }

  async function saveLeadInstructions() {
    if (!project) return;
    try {
      await updateDoc(doc(db, "projects", project.id), { leadInstructions: instructionsValue });
      setProject({ ...project, leadInstructions: instructionsValue });
      setEditingInstructions(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save lead instructions");
    }
  }

  async function saveCustomField() {
    if (!project || !fieldLabel.trim() || !fieldValue.trim()) return;
    try {
      const newField = { id: Date.now().toString(), label: fieldLabel, value: fieldValue };
      const updated = [...(project.customFields || []), newField];
      await updateDoc(doc(db, "projects", project.id), { customFields: updated });
      setProject({ ...project, customFields: updated });
      setAddingField(false);
      setFieldLabel("");
      setFieldValue("");
    } catch (e) {
      console.error(e);
      alert("Failed to add field");
    }
  }

  async function deleteCustomField(id: string) {
    if (!project) return;
    try {
      const updated = (project.customFields || []).filter((f: any) => f.id !== id);
      await updateDoc(doc(db, "projects", project.id), { customFields: updated });
      setProject({ ...project, customFields: updated });
    } catch (e) {
      console.error(e);
    }
  }

  async function saveMilestone() {
    if (!project || !milestoneTitle.trim() || !milestoneDate) return;
    try {
      const newMilestone = { 
        id: Date.now().toString(), 
        title: milestoneTitle, 
        date: milestoneDate, 
        completed: false 
      };
      const updated = [...(project.milestones || []), newMilestone];
      await updateDoc(doc(db, "projects", project.id), { milestones: updated });
      setProject({ ...project, milestones: updated });
      setAddingMilestone(false);
      setMilestoneTitle("");
      setMilestoneDate("");
    } catch (e) {
      console.error(e);
      alert("Failed to add milestone");
    }
  }

  async function toggleMilestone(id: string) {
    if (!project) return;
    try {
      const updated = (project.milestones || []).map((m: any) => 
        m.id === id ? { ...m, completed: !m.completed } : m
      );
      await updateDoc(doc(db, "projects", project.id), { milestones: updated });
      setProject({ ...project, milestones: updated });
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteMilestone(id: string) {
    if (!project) return;
    try {
      const updated = (project.milestones || []).filter((m: any) => m.id !== id);
      await updateDoc(doc(db, "projects", project.id), { milestones: updated });
      setProject({ ...project, milestones: updated });
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) return <div className="p-8 animate-pulse text-sm text-gray-500">Loading project details...</div>;
  if (!project) return <div className="p-8 text-sm text-gray-500">Project not found. <Link href="/projects" className="text-blue-600 underline">Go back</Link></div>;

  const st = STATUSES.find(s => s.key === project.status) || STATUSES[0];
  
  const projectAssignees = Array.isArray(project.assignedTo) ? project.assignedTo : (project.assignedTo ? [project.assignedTo] : []);
  const taskAssignees = projectTasks.map(t => t.assignedTo).filter(uid => uid);
  const allInvolvedUids = Array.from(new Set([...projectAssignees, ...taskAssignees]));
  const assignedUsers = users.filter(u => allInvolvedUids.includes(u.uid));

  const basePaid = project.paid ?? 0;
  const loggedPaid = (project.payments || []).reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = basePaid + loggedPaid;
  const calculatedRemaining = (project.budget ?? 0) - totalPaid;

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs mb-6" style={{ color: "#9ca3af" }}>
        <Link href="/projects" className="hover:text-[#0D1B3E] transition-colors">Projects</Link>
        <span>/</span>
        <span className="font-semibold" style={{ color: "#0D1B3E" }}>{project.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold" style={{ color: "#0D1B3E", fontFamily: "var(--font-playfair)" }}>{project.title}</h1>
            <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <p className="text-sm font-medium" style={{ color: "#6b7280" }}>{project.clientName}</p>
        </div>
        {crmUser?.role === "admin" && (
          <div className="flex flex-wrap items-center gap-4 text-right justify-end">
            <div className="bg-white border border-slate-200/60 shadow-sm rounded-xl px-5 py-4 min-w-[140px]">
              <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-1">Total Budget</p>
              <p className="text-xl font-bold text-slate-900 tracking-tight">
                {project.currency || "AED"} {(project.budget)?.toLocaleString() || "—"}
              </p>
            </div>
            <div className="bg-white border border-slate-200/60 shadow-sm rounded-xl px-5 py-4 min-w-[140px]">
              <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-1">Current Due</p>
              <p className="text-xl font-bold text-amber-600 tracking-tight">
                {project.currency || "AED"} {(project.due)?.toLocaleString() || "0"}
              </p>
            </div>
            <div className="bg-white border border-slate-200/60 shadow-sm rounded-xl px-5 py-4 min-w-[140px]">
              <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-1">Total Paid</p>
              <p className="text-xl font-bold text-emerald-600 tracking-tight">
                {project.currency || "AED"} {totalPaid.toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-slate-200/60 shadow-sm rounded-xl px-5 py-4 min-w-[140px]">
              <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-1">Remaining</p>
              <p className="text-xl font-bold text-rose-600 tracking-tight">
                {project.currency || "AED"} {calculatedRemaining.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-8 border-b mb-8" style={{ borderColor: "#f0f0f5" }}>
        {["overview", "tasks", "files", crmUser?.role === "admin" ? "payments" : null].filter(Boolean).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className="pb-4 text-sm font-bold capitalize relative transition-colors"
            style={{ color: activeTab === tab ? "#0D1B3E" : "#9ca3af" }}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-full" style={{ background: "#C9A84C" }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* MASTER BLUEPRINT BLOCK */}
              <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm group">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900">Master Blueprint</h3>
                  {!editingBlueprint && crmUser?.role === "admin" && (
                    <button 
                      onClick={() => { setBlueprintValue(project.masterBlueprint || ""); setEditingBlueprint(true); }}
                      className="text-xs font-semibold text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Pencil className="inline-block w-4 h-4 shrink-0 mr-1" /> Edit
                    </button>
                  )}
                </div>
                
                {editingBlueprint ? (
                  <div className="space-y-3">
                    <textarea 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#C9A84C] text-sm whitespace-pre-wrap text-slate-900 bg-slate-50"
                      rows={6}
                      value={blueprintValue}
                      onChange={e => setBlueprintValue(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={saveBlueprint} className="btn-primary py-1.5 px-4 text-xs">Save Blueprint</button>
                      <button onClick={() => setEditingBlueprint(false)} className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#6b7280" }}>
                    {project.masterBlueprint || "No master blueprint provided. Click edit to add the overall project architecture."}
                  </p>
                )}
              </div>

              {/* LEAD INSTRUCTIONS BLOCK */}
              <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-sm group border-l-4 border-l-blue-500">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900">Dynamic Lead Instructions</h3>
                  {!editingInstructions && (
                    <button 
                      onClick={() => { setInstructionsValue(project.leadInstructions || ""); setEditingInstructions(true); }}
                      className="text-xs font-semibold text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Pencil className="inline-block w-4 h-4 shrink-0 mr-1" /> Edit
                    </button>
                  )}
                </div>
                
                {editingInstructions ? (
                  <div className="space-y-3">
                    <textarea 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#C9A84C] text-sm whitespace-pre-wrap text-slate-900 bg-slate-50"
                      rows={4}
                      value={instructionsValue}
                      onChange={e => setInstructionsValue(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={saveLeadInstructions} className="btn-primary py-1.5 px-4 text-xs">Save Instructions</button>
                      <button onClick={() => setEditingInstructions(false)} className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#1a1a2e" }}>
                    {project.leadInstructions ? (
                      <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 text-slate-700">
                        {project.leadInstructions}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic font-medium">No lead instructions currently active for this phase.</span>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">TIMELINE</h3>
                  <p className="text-sm font-bold text-slate-900">
                    Deadline: {project.deadline ? new Date(project.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Not set"}
                  </p>
                </div>
                <div className="bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">SERVICE TYPE</h3>
                  <p className="text-sm font-bold text-slate-900 uppercase tracking-wider">{project.service}</p>
                </div>
              </div>

              {/* Technical Infrastructure Hub */}
              <div className="bg-white border border-slate-200/60 rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] group">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold" style={{ color: "#0D1B3E" }}>Technical Infrastructure Hub</h3>
                  {(crmUser?.role === "admin" || crmUser?.role === "lead") && !editingTechHub && (
                    <button 
                      onClick={() => setEditingTechHub(true)}
                      className="text-xs font-bold text-[#C9A84C] hover:underline"
                    >
                      <Pencil className="inline-block w-4 h-4 shrink-0 mr-1" /> Edit Provisioning
                    </button>
                  )}
                </div>

                {editingTechHub ? (
                  <div className="space-y-4">
                    {/* Tech Stack Pills */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Core Architecture Stack</label>
                      <div className="flex items-center gap-2 mt-1 mb-2">
                        <input
                          type="text"
                          placeholder="e.g. Three.js, Django..."
                          className="form-input text-xs py-1.5 px-3 rounded-lg border-slate-200 text-slate-900 bg-white text-slate-900 bg-white"
                          value={newTechTag}
                          onChange={(e) => setNewTechTag(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newTechTag.trim()) {
                              e.preventDefault();
                              const trimmed = newTechTag.trim();
                              if (!techHubForm.techStack.includes(trimmed)) {
                                setTechHubForm({ ...techHubForm, techStack: [...techHubForm.techStack, trimmed] });
                              }
                              setNewTechTag("");
                            }
                          }}
                        />
                        <span className="text-[10px] text-slate-400 italic">Press Enter to add</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {techHubForm.techStack.map((tech) => (
                          <span
                            key={tech}
                            className="px-3 py-1 rounded-full text-xs font-medium border bg-[#0D1B3E] text-white border-[#0D1B3E] flex items-center gap-1.5"
                          >
                            {tech}
                            <button
                              type="button"
                              onClick={() => {
                                setTechHubForm({
                                  ...techHubForm,
                                  techStack: techHubForm.techStack.filter(t => t !== tech)
                                });
                              }}
                              className="text-white hover:text-red-400 font-bold"
                            >
                              <X className="inline-block w-4 h-4 shrink-0 mr-1" />
                            </button>
                          </span>
                        ))}
                        {techHubForm.techStack.length === 0 && (
                          <span className="text-xs text-slate-400 italic py-1">No custom technologies defined</span>
                        )}
                      </div>
                    </div>

                    {/* Core Focus Toggle */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Primary Core Focus</label>
                      <input
                        type="text"
                        className="form-input text-xs w-full py-2 px-3 rounded-lg border-slate-200 text-slate-900 bg-white"
                        value={techHubForm.coreFocus}
                        onChange={(e) => setTechHubForm({ ...techHubForm, coreFocus: e.target.value })}
                        placeholder="e.g. Dynamic Web App"
                      />
                    </div>

                    {/* URL Inputs */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Figma Canvas URL</label>
                        <input className="form-input text-slate-900 bg-white" value={techHubForm.figmaUrl} onChange={(e) => setTechHubForm({ ...techHubForm, figmaUrl: e.target.value })} placeholder="https://figma.com/file/..." />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Repository Endpoint</label>
                        <input className="form-input text-slate-900 bg-white" value={techHubForm.repoUrl} onChange={(e) => setTechHubForm({ ...techHubForm, repoUrl: e.target.value })} placeholder="https://github.com/..." />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Staging Environment Link</label>
                          <input className="form-input text-slate-900 bg-white" value={techHubForm.stagingUrl} onChange={(e) => setTechHubForm({ ...techHubForm, stagingUrl: e.target.value })} placeholder="https://staging.domain.com" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Production Endpoint</label>
                          <input className="form-input text-slate-900 bg-white" value={techHubForm.productionUrl} onChange={(e) => setTechHubForm({ ...techHubForm, productionUrl: e.target.value })} placeholder="https://domain.com" />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button onClick={saveTechnicalHub} className="btn-primary py-1.5 px-4 text-xs">Save Provisioning</button>
                      <button onClick={() => setEditingTechHub(false)} className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                    <div className="space-y-5">
                      {/* Display URLs in Monospace dark/light blocks */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { label: "Figma Canvas URL", val: (project as any).figmaUrl },
                          { label: "Repository Endpoint", val: (project as any).repoUrl },
                          { label: "Staging Environment", val: (project as any).stagingUrl },
                          { label: "Production Endpoint", val: (project as any).productionUrl },
                        ].map((urlObj, index) => (
                          <div key={index} className="space-y-1.5">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pl-1">{urlObj.label}</span>
                            <div className={`text-xs border border-slate-200/60 p-3 rounded-lg flex items-center justify-between transition-all shadow-sm ${urlObj.val ? 'bg-white' : 'bg-slate-50/80'}`}>
                              <span className={`truncate mr-2 ${urlObj.val ? 'text-slate-700 font-mono font-medium tracking-tight' : 'text-slate-400 font-medium italic'}`}>
                                {urlObj.val || "Not Provisioned"}
                              </span>
                              {urlObj.val && (
                                <button 
                                  onClick={() => copyToClipboard(urlObj.val)} 
                                  className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors flex-shrink-0"
                                >
                                  Copy
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Display Stack Badges & Focus */}
                      <div className="flex items-start justify-between pt-4 mt-2 flex-wrap gap-6 border-t border-slate-100 ">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 pl-1">Primary Focus Scope</span>
                          {editingCoreFocus ? (
                            <input 
                              type="text"
                              autoFocus
                              className="text-xs font-bold bg-white  border border-[#C9A84C] text-[#C9A84C] px-3 py-1.5 rounded-lg shadow-sm outline-none w-48"
                              value={tempCoreFocus}
                              onChange={e => setTempCoreFocus(e.target.value)}
                              onBlur={async () => {
                                setEditingCoreFocus(false);
                                if (tempCoreFocus.trim() !== ((project as any).coreFocus || "Dynamic Web App")) {
                                  const newVal = tempCoreFocus.trim();
                                  try {
                                    await updateDoc(doc(db, "projects", project.id), { coreFocus: newVal });
                                    setProject({ ...project, coreFocus: newVal });
                                  } catch (err) { console.error(err); }
                                }
                              }}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                          ) : (
                            <span 
                              onClick={() => {
                                setTempCoreFocus((project as any).coreFocus || "Dynamic Web App");
                                setEditingCoreFocus(true);
                              }}
                              className="text-xs font-bold bg-[#C9A84C15] border border-[#C9A84C30] text-[#C9A84C] px-3 py-1.5 rounded-lg inline-block shadow-sm cursor-pointer hover:bg-[#C9A84C25] transition-colors"
                              title="Click to inline edit"
                            >
                              {(project as any).coreFocus || "Dynamic Web App"}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 pr-1">Tech Stack Matrix</span>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {((project as any).techStack || []).length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic py-1 px-2">No technologies defined</span>
                            ) : (
                              ((project as any).techStack || []).map((t: string) => (
                                <span key={t} className="text-xs font-bold bg-slate-100  border border-slate-200  text-[#0D1B3E]  px-2.5 py-1 rounded-md shadow-sm">
                                  {t}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              {/* Macro-Phase Progress Rail */}
              {(() => {
                const getTaskProgressVal = (status: string) => {
                  switch (status) {
                    case "not-started": return 0;
                    case "in-progress":
                    case "dev": return 25;
                    case "test": return 50;
                    case "review": return 75;
                    case "done":
                    case "completed": return 100;
                    default: return 0;
                  }
                };
                
                const totalTasksCount = projectTasks.length;
                const progressMean = totalTasksCount > 0
                  ? Math.round(projectTasks.reduce((sum, t) => sum + getTaskProgressVal(t.status), 0) / totalTasksCount)
                  : 0;

                const phases = [
                  { label: "Scope & Wireframes", range: "0-25%" },
                  { label: "Component Eng.", range: "26-50%" },
                  { label: "Logic & Integration", range: "51-75%" },
                  { label: "Optimization & Handoff", range: "76-100%" }
                ];
                
                // Determine active phase based on progress mean
                let activeIndex = 0;
                if (progressMean > 75) activeIndex = 3;
                else if (progressMean > 50) activeIndex = 2;
                else if (progressMean > 25) activeIndex = 1;
                else activeIndex = 0;

                return (
                  <div className="bg-white border border-slate-200/70 rounded-2xl p-8 shadow-sm mb-6 transition-all hover:shadow-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12">
                      <div>
                        <h3 className="text-lg font-extrabold tracking-tight text-slate-900">Project Timeline</h3>
                        <p className="text-xs text-slate-500 font-medium mt-1">Macro-phase progress overview</p>
                      </div>
                      <div className="mt-4 sm:mt-0 px-4 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-black tracking-widest border border-blue-100 shadow-inner">
                        {progressMean}% COMPLETE
                      </div>
                    </div>
                    
                    <div className="relative mt-8 mb-16 px-4 md:px-8">
                      {/* Base Track */}
                      <div className="absolute top-5 left-8 right-8 h-1.5 bg-slate-100 rounded-full shadow-inner" />
                      
                      {/* Active Fill Track */}
                      <div 
                        className="absolute top-5 left-8 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-1000 ease-out shadow-sm" 
                        style={{ width: `calc(${Math.max(0, Math.min(100, progressMean))}% - 4rem)` }}
                      />
                      
                      <div className="relative flex justify-between items-center z-10">
                        {phases.map((phase, idx) => {
                          const isCompleted = progressMean >= (idx + 1) * 25 || (idx === 0 && progressMean > 0);
                          const isActive = idx === activeIndex;

                          return (
                            <div key={idx} className="relative flex flex-col items-center w-10">
                              {/* Node Circle */}
                              <div 
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 ring-4 bg-white ${
                                  isCompleted
                                    ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white ring-blue-50 shadow-md shadow-blue-500/20 border-0"
                                    : isActive
                                      ? "text-indigo-600 ring-indigo-50 border-2 border-indigo-500 shadow-lg shadow-indigo-500/30 scale-110"
                                      : "text-slate-400 ring-transparent border-2 border-slate-200"
                                }`}
                              >
                                {isCompleted && !isActive ? (
                                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  idx + 1
                                )}
                              </div>
                              
                              {/* Label */}
                              <div className="absolute top-14 left-1/2 -translate-x-1/2 w-32 text-center pt-2">
                                <p className={`text-xs font-bold tracking-wide transition-colors duration-300 ${
                                  isActive ? 'text-indigo-700' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                                }`}>
                                  {phase.label}
                                </p>
                                <p className="text-[10px] font-semibold text-slate-400 mt-1 tracking-wider">{phase.range}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

          {activeTab === "tasks" && (
            <div className="space-y-4">
              {/* Metric header */}
              {(() => {
                const pending = projectTasks.filter(t => t.status !== "completed").length;
                const completed = projectTasks.filter(t => t.status === "completed").length;
                return (
                  <div className="bg-white text-slate-700 rounded-xl px-5 py-3 border border-slate-200/60 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Runway Velocity:</span>
                      <span className="text-[11px] font-bold text-slate-900">
                        {pending} Pending &middot; {completed} Completed
                      </span>
                    </div>
                    {(crmUser?.role === "admin" || crmUser?.role === "lead") && (
                      <button 
                        onClick={() => setShowDelegateModal(true)}
                        className="px-4 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-opacity hover:opacity-90 shadow-sm"
                        style={{ background: "#0D1B3E", color: "#FFFFFF" }}
                      >
                        + Delegate Task
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* The Runway Grid Layout */}
              <div className="space-y-2">
                {projectTasks.length === 0 ? (
                  <div className="text-center py-12 bg-white border border-slate-200/60 rounded-xl shadow-sm">
                    <p className="text-sm font-medium text-slate-500">No tasks delegated to this workspace yet.</p>
                  </div>
                ) : (
                  projectTasks.map(task => {
                    const pct = Math.round((getMilestoneIndex(task.status) / 4) * 100);
                    
                    // Priority configurations
                    let pBg = "bg-slate-100 text-slate-600 border-slate-200";
                    if (task.priority === "high") pBg = "bg-rose-50 text-rose-700 border-rose-200/60";
                    else if (task.priority === "medium") pBg = "bg-amber-50 text-amber-700 border-amber-200/60";
                    
                    return (
                      <div 
                        key={task.id} 
                        onClick={() => router.push(`/tasks/${task.id}`)}
                        className="w-full bg-white border border-slate-200/60 rounded-xl p-4 lg:p-5 flex flex-wrap items-center justify-between gap-y-4 gap-x-4 lg:gap-x-6 transition-all duration-200 hover:bg-slate-50/80 shadow-sm cursor-pointer"
                      >
                        {/* Left Section: Title, Priority, Micro-avatar */}
                        <div className="flex items-center space-x-4 flex-1 min-w-[200px] order-1">
                          {/* Micro-avatar */}
                          <div 
                            className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0"
                            title={`Assigned to: ${task.assignedToName || "Unassigned"}`}
                          >
                            {task.assignedToName?.charAt(0).toUpperCase() || "?"}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 truncate" style={{ textDecoration: task.status === "completed" ? "line-through text-slate-400" : "none" }}>
                              {task.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${pBg} whitespace-nowrap`}>
                                {task.priority || "medium"}
                              </span>
                              {task.dueDate && (
                                <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
                                  Due: {new Date(task.dueDate).toLocaleDateString("en-GB", { month: "short", day: "numeric" })} {task.time ? `at ${task.time}` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Center Section: Linear Progress Rail */}
                        <div className="w-full lg:w-48 xl:w-56 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200/50 flex-shrink-0 order-3 lg:order-2 mt-2 lg:mt-0" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            <span>{task.status.replace("-", " ")}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200/80 rounded-full flex relative">
                            {/* Active segment fill */}
                            <div 
                              className="absolute top-0 bottom-0 left-0 bg-blue-500 rounded-full transition-all duration-300" 
                              style={{ width: `${pct}%` }} 
                            />
                            {/* Stepper Hitboxes */}
                            {milestoneSteps.map((step) => (
                              <div
                                key={step.key}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTaskStatus(task, step.key);
                                }}
                                className="flex-1 h-full cursor-pointer z-10 hover:bg-blue-400/20 transition-colors"
                                title={`Set milestone to ${step.label}`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Right Section: Action Dropdowns */}
                        <div className="flex items-center justify-end gap-2 flex-shrink-0 order-2 lg:order-3">
                          {(crmUser?.role === "admin" || crmUser?.role === "lead") && (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <select
                                value={task.assignedTo || ""}
                                onChange={(e) => reallocateAsset(task, e.target.value)}
                                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium px-3 h-9 outline-none focus:border-[#C9A84C] cursor-pointer shadow-sm w-32 flex-shrink-0"
                              >
                                <option value="">Re-allocate...</option>
                                {users
                                  .filter(u => u.role !== "admin")
                                  .map(u => (
                                    <option key={u.uid} value={u.uid}>{u.name}</option>
                                  ))
                                }
                              </select>
                            </div>
                          )}
                          
                          <div onClick={e => e.stopPropagation()}>
                            <select
                              value=""
                              onChange={(e) => {
                                const action = e.target.value;
                                if (action === "inspect") router.push(`/tasks/${task.id}`);
                                else if (action === "note") { setNoteModalTask(task); setShowNoteModal(true); }
                                else if (action === "delete") deleteTask(task.id);
                                e.target.value = ""; // Reset
                              }}
                              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold px-3 h-9 outline-none focus:border-[#C9A84C] cursor-pointer shadow-sm w-32 flex-shrink-0"
                            >
                              <option value="" disabled hidden>Options...</option>
                              <option value="inspect"><Search className="inline-block w-4 h-4 shrink-0 mr-1" /> Inspect</option>
                              {(crmUser?.role === "admin" || crmUser?.role === "lead") && (
                                <>
                                  <option value="note"><ClipboardList className="inline-block w-4 h-4 shrink-0 mr-1" /> Instructions</option>
                                  <option value="delete"><Trash2 className="inline-block w-4 h-4 shrink-0 mr-1" /> Delete</option>
                                </>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === "files" && (
            <div className="space-y-6">
              {/* Asset Vault Intake Grid */}
              <div className="bg-white  backdrop-blur-md border border-slate-200  rounded-2xl p-6 shadow-xl">
                <h3 className="text-sm font-bold mb-4 text-slate-900  flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                  Asset Vault
                </h3>
                
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <input 
                    className="w-full md:flex-1 bg-slate-50  border border-slate-200  rounded-xl px-4 py-3 text-sm text-slate-900  placeholder-slate-400  focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all" 
                    placeholder="Custom Asset Name (e.g. Figma Wireframes)"
                    value={assetName}
                    onChange={e => setAssetName(e.target.value)}
                  />
                  <input 
                    className="w-full md:flex-1 bg-slate-50  border border-slate-200  rounded-xl px-4 py-3 text-sm text-slate-900  placeholder-slate-400  focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all" 
                    placeholder="Asset URL Link"
                    value={assetUrl}
                    onChange={e => setAssetUrl(e.target.value)}
                  />
                  
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <select 
                      className="w-full md:w-[150px] bg-slate-50  border border-slate-200  rounded-xl px-4 py-3 text-sm font-semibold text-slate-700  focus:outline-none focus:border-blue-500 transition-all cursor-pointer" 
                      value={assetCategory} 
                      onChange={e => setAssetCategory(e.target.value)}
                    >
                      <option value="Design">Design</option>
                      <option value="Development">Development</option>
                      <option value="Documentation">Documentation</option>
                      <option value="Credentials">Credentials</option>
                    </select>
                    
                    <button 
                      onClick={addAsset}
                      disabled={addingFile || !assetName.trim() || !assetUrl.trim()}
                      className="whitespace-nowrap px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md disabled:opacity-50 transition-all"
                    >
                      {addingFile ? "Adding..." : "+ Add Asset"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Asset Registry List */}
              <div className="space-y-4 mt-8">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-slate-900  uppercase tracking-wider">Project Assets</h3>
                  {/* Category Filter Tabs */}
                  <div className="flex items-center gap-1 bg-slate-200/80  p-1.5 rounded-xl border border-slate-300 ">
                    {["All", "Design", "Development", "Documentation", "Credentials"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategoryFilter(cat as any)}
                        className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
                          activeCategoryFilter === cat
                            ? "bg-[#0D1B3E] text-[#C9A84C] shadow-md  "
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-300/50   "
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {(() => {
                    const shared = (project as any).sharedFiles || [];
                    const filtered = shared.filter((f: any) => 
                      activeCategoryFilter === "All" || (f.category || "Documentation") === activeCategoryFilter
                    );
                    
                    if (filtered.length === 0) {
                      return <div className="text-center py-10 bg-slate-50  rounded-2xl border border-dashed border-slate-200 "><p className="text-sm font-medium text-slate-500">No assets match this category.</p></div>;
                    }

                    return filtered.map((file: any, index: number) => {
                      const origIndex = shared.indexOf(file);
                      
                      // Platform Icon Logic
                      const isFigma = file.url.includes("figma.com");
                      const isGithub = file.url.includes("github.com") || file.url.includes("gitlab.com") || file.url.includes("bitbucket");
                      
                      let Icon = (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                      );
                      
                      if (isFigma) {
                        Icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500"><path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"></path><path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"></path><path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"></path><path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"></path><path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"></path></svg>;
                      } else if (isGithub) {
                        Icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-800 "><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>;
                      }

                      // Category Badge Logic
                      const cat = file.category?.toUpperCase() || "DOCUMENTATION";
                      let badgeClasses = "bg-slate-500/10 text-slate-500 border-slate-500/20";
                      
                      if (cat === "DESIGN") badgeClasses = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                      else if (cat === "DEVELOPMENT") badgeClasses = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                      else if (cat === "DOCUMENTATION") badgeClasses = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                      else if (cat === "CREDENTIALS") badgeClasses = "bg-rose-500/10 text-rose-400 border-rose-500/20";

                      return (
                        <div key={index} className="flex items-center justify-between p-5 rounded-2xl bg-white  border border-slate-200  shadow-sm hover:shadow-md transition-all group">
                          <div className="flex items-center gap-4 truncate">
                            <div className="w-12 h-12 rounded-xl bg-slate-50  border border-slate-100  flex items-center justify-center flex-shrink-0">
                              {Icon}
                            </div>
                            <div className="truncate">
                              <p className="text-sm font-semibold text-slate-900  truncate mb-0.5">{file.name}</p>
                              <p className="text-[11px] font-mono text-slate-400  truncate max-w-xs md:max-w-md lg:max-w-lg mb-1">{file.url}</p>
                              <p className="text-[10px] font-medium text-slate-400">Added by {file.addedBy} &bull; {new Date(file.at).toLocaleDateString("en-GB")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                            <span className={`hidden md:inline-block px-2.5 py-1 rounded-md text-[9px] font-black tracking-widest border ${badgeClasses}`}>
                              {cat}
                            </span>
                            <a 
                              href={file.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-xs font-bold text-blue-500 hover:text-blue-600  hover:underline flex items-center gap-1"
                            >
                              Open Link <span className="text-[10px]">↗</span>
                            </a>
                            {(crmUser?.role === "admin" || crmUser?.role === "lead") && (
                              <button 
                                onClick={() => deleteFile(origIndex)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50  hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete Asset"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="space-y-6">
              <div className="crm-card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: "#0D1B3E" }}>Payment Ledger</h3>
                    <p className="text-xs text-slate-500 mt-1">Track and manage financial transactions for this project.</p>
                  </div>
                  <div className="relative group">
                    <button className="btn-primary py-2 px-4 text-xs flex items-center gap-2 shadow-md">
                      Payment Actions ▼
                    </button>
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <button 
                        onClick={() => {
                          setEditingPaymentId(null);
                          setPaymentForm({ amount: "", date: new Date().toISOString().split('T')[0], method: "Bank Transfer", notes: "" });
                          setShowPaymentModal(true);
                        }}
                        className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-100 flex items-center gap-3 transition-colors"
                      >
                        <span className="text-sm"><DollarSign className="inline-block w-4 h-4 shrink-0 mr-1" /></span> Log Manual Payment
                      </button>
                      <button 
                        onClick={openEditFinancials}
                        className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-100 flex items-center gap-3 transition-colors"
                      >
                        <span className="text-sm"><Pencil className="inline-block w-4 h-4 shrink-0 mr-1" /></span> Edit Financials
                      </button>
                      <button 
                        onClick={handleGenerateInvoice}
                        className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-100 flex items-center gap-3 transition-colors"
                      >
                        <span className="text-sm"><ClipboardList className="inline-block w-4 h-4 shrink-0 mr-1" /></span> Generate Invoice
                      </button>
                      <button 
                        onClick={openReminder}
                        className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                      >
                        <span className="text-sm"><Bell className="inline-block w-4 h-4 shrink-0 mr-1" /></span> Send Payment Reminder
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Total Budget</p>
                    <p className="text-lg font-black text-[#0D1B3E]">{project.currency || "AED"} {project.budget?.toLocaleString() || "0"}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-orange-100 bg-orange-50">
                    <p className="text-[10px] font-bold text-orange-600 mb-1 uppercase tracking-wider">Current Due</p>
                    <p className="text-lg font-black text-orange-700">{project.currency || "AED"} {project.due?.toLocaleString() || "0"}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-green-100 bg-green-50">
                    <p className="text-[10px] font-bold text-green-600 mb-1 uppercase tracking-wider">Total Paid</p>
                    <p className="text-lg font-black text-green-700">{project.currency || "AED"} {totalPaid.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-red-100 bg-red-50">
                    <p className="text-[10px] font-bold text-red-600 mb-1 uppercase tracking-wider">Remaining</p>
                    <p className="text-lg font-black text-red-700">{project.currency || "AED"} {calculatedRemaining.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-slate-500">Payment Progress</span>
                    <span className="text-green-600">{Math.round((totalPaid / (project.budget || 1)) * 100)}% Paid</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (totalPaid / (project.budget || 1)) * 100)}%` }}></div>
                  </div>
                </div>

                <div className="space-y-3">
                  {(!project.payments || project.payments.length === 0) ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-400 font-medium">No payments logged yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-slate-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-4 font-bold text-slate-500 text-xs">Date</th>
                            <th className="p-4 font-bold text-slate-500 text-xs">Method</th>
                            <th className="p-4 font-bold text-slate-500 text-xs text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {project.payments.slice().reverse().map((payment) => (
                            <tr key={payment.id} className="bg-white hover:bg-slate-50 transition-colors group">
                              <td className="p-4 text-slate-900 font-medium">
                                {new Date(payment.date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' })}
                                {payment.notes && <p className="text-[10px] text-slate-400 mt-1">{payment.notes}</p>}
                                <p className="text-[9px] text-slate-300 mt-1">Logged by {payment.loggedBy}</p>
                              </td>
                              <td className="p-4">
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                  {payment.method}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <span className="text-sm font-black text-green-700">{project.currency || "AED"} {payment.amount.toLocaleString()}</span>
                                {crmUser?.role === "admin" && (
                                  <div className="flex justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => {
                                        setEditingPaymentId(payment.id);
                                        setPaymentForm({
                                          amount: payment.amount.toString(),
                                          date: payment.date,
                                          method: payment.method,
                                          notes: payment.notes || ""
                                        });
                                        setShowPaymentModal(true);
                                      }} 
                                      className="text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                      EDIT
                                    </button>
                                    <button 
                                      onClick={() => deletePayment(payment.id)} 
                                      className="text-[10px] font-bold text-slate-400 hover:text-red-600 transition-colors"
                                    >
                                      DELETE
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="crm-card">
            <h3 className="text-sm font-bold mb-4" style={{ color: "#0D1B3E" }}>Team Members</h3>
            <div className="space-y-3">
              {assignedUsers.length ? assignedUsers.map(user => (
                <div key={user.uid} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#C9A84C20", color: "#C9A84C" }}>
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "#1a1a2e" }}>{user.name}</p>
                    <p className="text-[10px]" style={{ color: "#9ca3af" }}>{user.role}</p>
                  </div>
                </div>
              )) : <p className="text-xs text-gray-400">No members assigned.</p>}
            </div>
          </div>

          <div className="crm-card">
            <h3 className="text-sm font-bold mb-4" style={{ color: "#0D1B3E" }}>Last Update</h3>
            <p className="text-xs" style={{ color: "#9ca3af" }}>
              {project.updatedAt ? new Date(project.updatedAt).toLocaleString("en-GB") : "Never"}
            </p>
          </div>
        </div>
      </div>

      {/* Log Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl relative">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900">{editingPaymentId ? "Edit Payment Record" : "Log New Payment"}</h3>
              <button 
                onClick={() => { setShowPaymentModal(false); setEditingPaymentId(null); setPaymentForm({ amount: "", date: new Date().toISOString().split('T')[0], method: "Bank Transfer", notes: "" }); }}
                className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="inline-block w-4 h-4 shrink-0 mr-1" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Amount ({project.currency || "AED"})</label>
                <input 
                  type="number" 
                  value={paymentForm.amount} 
                  onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#C9A84C] outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Date</label>
                <input 
                  type="date" 
                  value={paymentForm.date} 
                  onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#C9A84C] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Payment Method</label>
                <select 
                  value={paymentForm.method} 
                  onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#C9A84C] outline-none"
                >
                  <option>Bank Transfer</option>
                  <option>Credit Card / Stripe</option>
                  <option>Cash</option>
                  <option>Cheque</option>
                  <option>Crypto</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Notes / Ref # (Optional)</label>
                <input 
                  type="text" 
                  value={paymentForm.notes} 
                  onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-[#C9A84C] outline-none"
                  placeholder="e.g. Wire transfer TR-9102"
                />
              </div>
              <button 
                onClick={logPayment}
                disabled={loggingPayment || !paymentForm.amount}
                className="w-full mt-2 bg-[#0D1B3E] hover:bg-[#1a2b5e] text-white py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              >
                {loggingPayment ? "Saving..." : (editingPaymentId ? "Save Changes" : "Confirm Payment")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Financials Modal */}
      {showFinancialsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-900">Edit Financials</h3>
              <button onClick={() => setShowFinancialsModal(false)} className="text-slate-400 hover:text-slate-700"><X className="inline-block w-4 h-4 shrink-0 mr-1" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Total Budget</label>
                  <input 
                    type="number" 
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#C9A84C]"
                    value={finForm.budget}
                    onChange={e => {
                      const b = Number(e.target.value) || 0;
                      const p = Number(finForm.paid) || 0;
                      setFinForm({...finForm, budget: e.target.value, remaining: (b - p).toString()});
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Current Due</label>
                  <input 
                    type="number" 
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#C9A84C]"
                    value={finForm.due}
                    onChange={e => setFinForm({...finForm, due: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Amount Paid</label>
                  <input 
                    type="number" 
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#C9A84C]"
                    value={finForm.paid}
                    onChange={e => {
                      const p = Number(e.target.value) || 0;
                      const b = Number(finForm.budget) || 0;
                      setFinForm({...finForm, paid: e.target.value, remaining: (b - p).toString()});
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Remaining</label>
                  <input 
                    type="number" 
                    readOnly
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 outline-none"
                    value={finForm.remaining}
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={saveFinancials} 
              disabled={savingFin}
              className="mt-8 w-full py-3 bg-[#0D1B3E] hover:bg-[#1a3070] text-white rounded-xl font-bold transition-all disabled:opacity-50"
            >
              {savingFin ? "Saving..." : "Save Financials"}
            </button>
          </div>
        </div>
      )}

      {/* Send Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-900">Send Payment Reminder</h3>
              <button onClick={() => setShowReminderModal(false)} className="text-slate-400 hover:text-slate-700"><X className="inline-block w-4 h-4 shrink-0 mr-1" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Message Body</label>
                <textarea 
                  rows={10}
                  className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:border-[#C9A84C] text-sm font-medium text-slate-700 leading-relaxed resize-none"
                  value={reminderBody}
                  onChange={e => setReminderBody(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setShowReminderModal(false)} 
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={sendReminder} 
                disabled={sendingReminder}
                className="flex-1 py-3 bg-[#0D1B3E] hover:bg-[#1a3070] text-white rounded-xl font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {sendingReminder ? "Sending..." : <><span><Mail className="inline-block w-4 h-4 shrink-0 mr-1" /></span> Send Reminder Email</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delegate Task Modal */}
      {showDelegateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-900">Delegate Task</h3>
              <button onClick={() => setShowDelegateModal(false)} className="text-slate-400 hover:text-slate-700"><X className="inline-block w-4 h-4 shrink-0 mr-1" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Task Type *</label>
                <select 
                  className="form-input mb-4 text-slate-900 bg-white"
                  value={delegateForm.taskType}
                  onChange={e => setDelegateForm({...delegateForm, taskType: e.target.value as SystemTaskType})}
                >
                  <option value="project-task">Project Task</option>
                  {crmUser?.role === "admin" && <option value="meeting">Internal Meeting</option>}
                  {crmUser?.role === "admin" && <option value="follow-up">Follow-up</option>}
                  <option value="internal-task">Internal Task</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Task Title *</label>
                <input 
                  type="text" 
                  className="form-input text-slate-900 bg-white"
                  placeholder="e.g. Implement Figma Designs"
                  value={delegateForm.title}
                  onChange={e => setDelegateForm({...delegateForm, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Select Employee Asset *</label>
                <select 
                  className="form-input text-slate-900 bg-white"
                  value={delegateForm.employeeId}
                  onChange={e => setDelegateForm({...delegateForm, employeeId: e.target.value})}
                >
                  <option value="">Select an employee...</option>
                  {users
                    .filter(u => u.role !== "admin")
                    .map(u => (
                      <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
                    ))
                  }
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Due Date</label>
                  <input 
                    type="date" 
                    className="form-input text-slate-900 bg-white"
                    value={delegateForm.dueDate}
                    onChange={e => setDelegateForm({...delegateForm, dueDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Time</label>
                  <input 
                    type="time" 
                    className="form-input text-slate-900 bg-white"
                    value={delegateForm.time}
                    onChange={e => setDelegateForm({...delegateForm, time: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Task Instructions</label>
                <textarea 
                  className="form-input resize-none text-slate-900 bg-white"
                  rows={4}
                  placeholder="Provide step-by-step directions for the employee..."
                  value={delegateForm.instructions}
                  onChange={e => setDelegateForm({...delegateForm, instructions: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowDelegateModal(false)}
                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
              <button 
                onClick={delegateTask}
                disabled={delegating || !delegateForm.employeeId || !delegateForm.title}
                className="flex-1 py-3 text-sm font-bold text-white bg-[#0D1B3E] rounded-xl hover:opacity-90 disabled:opacity-50"
              >
                {delegating ? "Assigning..." : "Assign Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Assignment Interceptor Modal */}
      {duplicateConflictTask && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-red-600 mb-1">Duplicate Task Assignment</h3>
                <p className="text-xs text-slate-500">This employee is already assigned to an active task on this project: <strong className="text-slate-800">{duplicateConflictTask.title}</strong></p>
              </div>
              <button onClick={() => setDuplicateConflictTask(null)} className="text-slate-400 hover:text-slate-700"><X className="inline-block w-4 h-4 shrink-0 mr-1" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">Option A: Add Instruction Note</h4>
                <textarea 
                  className="w-full p-3 text-xs rounded-xl border border-blue-200 outline-none focus:border-blue-400 bg-white resize-none"
                  rows={3}
                  placeholder="Type new instructions here..."
                  value={duplicateInstructionNote}
                  onChange={e => setDuplicateInstructionNote(e.target.value)}
                />
                <button 
                  onClick={async () => {
                    if (!duplicateInstructionNote.trim()) return;
                    try {
                      await updateDoc(doc(db, "tasks", duplicateConflictTask.id), { 
                        taskInstructions: (duplicateConflictTask.taskInstructions || "") + "\n\n[NEW INSTRUCTIONS]: " + duplicateInstructionNote 
                      });
                      alert("Instructions added successfully!");
                      setDuplicateConflictTask(null);
                      setDuplicateInstructionNote("");
                      setShowDelegateModal(false);
                      setDelegateForm({ employeeId: "", title: "", instructions: "", taskType: "project-task", dueDate: "", time: "" });
                    } catch(e) {
                      console.error(e);
                      alert("Failed to add instructions");
                    }
                  }}
                  disabled={!duplicateInstructionNote.trim()}
                  className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  Add Instructions to Existing Task
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setDuplicateConflictTask(null);
                    setShowDelegateModal(false);
                    setSelectedDrawerTask(duplicateConflictTask);
                  }}
                  className="p-4 rounded-xl border border-slate-200 hover:border-[#C9A84C] hover:bg-[#C9A84C]/5 text-left transition-all group"
                >
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 group-hover:text-[#C9A84C]">Option B</h4>
                  <p className="text-xs font-semibold text-slate-700">Modify Existing Task</p>
                  <p className="text-[9px] text-slate-400 mt-1">Open detail drawer to adjust deadlines or parameters.</p>
                </button>

                <button 
                  onClick={() => {
                    setDuplicateConflictTask(null);
                  }}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-all group"
                >
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Option C</h4>
                  <p className="text-xs font-semibold text-slate-700">Assign Alternate</p>
                  <p className="text-[9px] text-slate-400 mt-1">Return to dropdown to pick another team asset.</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-200 mb-3 uppercase tracking-wider">Add Project Instructions</h3>
            <textarea 
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono mb-4 min-h-[100px]"
              placeholder="Type your new task instructions here..."
              value={noteModalText}
              onChange={e => setNoteModalText(e.target.value)}
            />
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteModalText("");
                  setNoteModalTask(null);
                }} 
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (noteModalTask && noteModalText) {
                    const newInstruction = (noteModalTask.taskInstructions || "") + "\n\n[NEW INSTRUCTIONS]: " + noteModalText;
                    updateTaskInstructions(noteModalTask, newInstruction);
                  }
                  setShowNoteModal(false);
                  setNoteModalText("");
                  setNoteModalTask(null);
                }} 
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Save Instructions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Drawer */}
      <AnimatePresence>
        {selectedDrawerTask && (() => {
          const isLeadOrAdmin = crmUser?.role === "admin" || crmUser?.role === "lead";
          const isAssignedEmployee = crmUser?.uid === selectedDrawerTask.assignedTo;
          
          const summary = selectedDrawerTask.projectSummary || (project as any)?.projectSummary || "No master brief provided by Admin.";
          const instructions = selectedDrawerTask.taskInstructions || selectedDrawerTask.description || "No specific instructions provided by Lead.";
          const logs = selectedDrawerTask.logs || [];

          return (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity"
                onClick={() => setSelectedDrawerTask(null)}
              />
              
              {/* Sliding Panel */}
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-[700px] bg-slate-50 shadow-2xl border-l border-slate-200 z-[101] flex flex-col text-slate-800"
              >
                {/* Header */}
                <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-[#0D1B3E]">{selectedDrawerTask.title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      {selectedDrawerTask.clientName && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          <Building2 className="inline-block w-4 h-4 shrink-0 mr-1" /> {selectedDrawerTask.clientName}
                        </span>
                      )}
                      {selectedDrawerTask.assignedToName && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                          <User className="inline-block w-4 h-4 shrink-0 mr-1" /> Assignee: {selectedDrawerTask.assignedToName}
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedDrawerTask(null)} 
                    className="text-slate-400 hover:text-slate-600 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-xl font-bold"
                  >
                    <X className="inline-block w-4 h-4 shrink-0 mr-1" />
                  </button>
                </div>

                {/* Two Column Layout Body */}
                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Column A (Scope) */}
                  <div className="space-y-6">
                    {/* Admin's Project Summary */}
                    <div className="crm-card bg-white p-4 rounded-2xl border border-slate-150 shadow-sm">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Project Execution Strategy</h4>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        {summary}
                      </p>
                    </div>

                    {/* Lead's Task Instructions */}
                    <div className="crm-card bg-white p-4 rounded-2xl border border-slate-150 shadow-sm">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Lead Directions & Scope</h4>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        {instructions}
                      </p>
                    </div>
                  </div>

                  {/* Column B (Execution Log) */}
                  <div className="space-y-6 flex flex-col h-full">
                    {/* Log Console for Employee */}
                    {isAssignedEmployee && !isLeadOrAdmin ? (
                      <div className="crm-card bg-white p-4 rounded-2xl border border-slate-150 shadow-sm flex flex-col">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Status Log Entry</h4>
                        <textarea 
                          rows={4}
                          value={logInputText}
                          onChange={(e) => setLogInputText(e.target.value)}
                          placeholder="Type log entry update here..."
                          className="form-input resize-none text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-[#C9A84C] text-slate-900 bg-white"
                        />
                        <button 
                          onClick={commitLogEntry}
                          disabled={!logInputText.trim()}
                          className="mt-3 py-2 px-4 rounded-xl text-xs font-bold text-white bg-[#0D1B3E] hover:opacity-90 disabled:opacity-50 transition-all self-end"
                        >
                          Commit to Log Sheet
                        </button>
                      </div>
                    ) : (
                      isAssignedEmployee && (
                        <div className="text-xs text-slate-400 italic p-4 bg-white rounded-2xl border text-center shadow-sm">
                          Leads and Admins do not log status entries.
                        </div>
                      )
                    )}

                    {/* Log Timeline for Lead/Admin */}
                    {isLeadOrAdmin ? (
                      <div className="crm-card bg-white p-4 rounded-2xl border border-slate-150 shadow-sm flex-1 flex flex-col">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Chronological Log Stream</h4>
                        
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[300px]">
                          {logs.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-8">No committed log entries found.</p>
                          ) : (
                            logs.slice().reverse().map((log: any) => (
                              <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-slate-600">{log.authorName}</span>
                                  <span className="text-[8px] text-slate-400">{new Date(log.timestamp).toLocaleString("en-GB")}</span>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed font-medium">{log.text}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      !isAssignedEmployee && (
                        <div className="text-xs text-slate-400 italic p-4 bg-white rounded-2xl border text-center shadow-sm">
                          Logs are private to project assignees and managers.
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Footer Drawer Action items (Delete options) */}
                {isLeadOrAdmin && (
                  <div className="p-4 bg-white border-t border-slate-200 flex gap-3 justify-end">
                    <button 
                      onClick={() => {
                        deleteTask(selectedDrawerTask.id);
                        setSelectedDrawerTask(null);
                      }} 
                      className="px-4 py-2 border rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border-red-200 transition-all"
                    >
                      <Trash2 className="inline-block w-4 h-4 shrink-0 mr-1" /> Delete Task
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
