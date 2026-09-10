"use client";
import { Rocket, MessageSquare, Check, Target, Clipboard } from "lucide-react";


import { useEffect, useState, useRef } from "react";
import { doc, getDoc, onSnapshot, updateDoc, arrayUnion, getDocs, collection, query, where, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function TaskOperationalSheet({ params }: { params: { id: string } }) {
  const { id } = params;
  const { crmUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const initialTab = searchParams.get("tab") === "chat" ? "chat" : "blueprints";
  const [activeTab, setActiveTab] = useState<"blueprints" | "chat">(initialTab);

  // Sync tab state if URL query param changes without full page reload
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "chat" || tab === "blueprints") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const [localProgress, setLocalProgress] = useState(0);
  const [localDesc, setLocalDesc] = useState("");
  
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingLogText, setEditingLogText] = useState("");
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [parentProject, setParentProject] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    
    // Explicitly wipe state when switching tasks to prevent ghost data
    setLocalProgress(0);
    setLocalDesc("");
    setTask(null);
    setParentProject(null);
    setLoading(true);

    const unsub = onSnapshot(doc(db, "tasks", id), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTask({ id: docSnap.id, ...data });
        
        if (data.relatedTo) {
          try {
            const projDoc = await getDoc(doc(db, "projects", data.relatedTo));
            if (projDoc.exists()) {
              setParentProject(projDoc.data());
            }
          } catch (e) {
            console.error("Failed to fetch parent project", e);
          }
        }

        let p = data.progress;
        if (p === undefined) {
          if (data.status === "dev") p = 25;
          else if (data.status === "in-progress" || data.status === "test") p = 50;
          else if (data.status === "review") p = 75;
          else if (data.status === "completed" || data.status === "done") p = 100;
          else p = 0;
        }
        setLocalProgress(p);
      } else {
        router.push("/tasks");
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id, router]);

  useEffect(() => {
    if (activeTab === "chat") {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    }
  }, [activeTab, task?.activityLogs]);

  if (loading) {
    return <div className="p-10 text-center text-slate-500 font-bold animate-pulse">Loading Workspace...</div>;
  }

  if (!task || !crmUser) return null;

  const isAssignedEmployee = crmUser.uid === task.assignedTo;
  
  // Security Barrier
  if (crmUser.role === "employee" && !isAssignedEmployee) {
    return (
      <div className="p-10 text-center flex flex-col items-center">
        <h2 className="text-2xl font-black text-red-500 mb-2">Access Denied</h2>
        <p className="text-slate-500 mb-6">This task belongs to another team member.</p>
        <button onClick={() => router.push("/tasks")} className="px-6 py-2 bg-[#0D1B3E] text-white rounded-lg font-bold">Return to Dashboard</button>
      </div>
    );
  }

  const projectBlueprint = task.masterBlueprint || parentProject?.masterBlueprint || task.projectSummary || "";
  const leadInstructions = task.leadInstructions || parentProject?.leadInstructions || "";
  const taskInstructions = task.taskInstructions || task.description || "No specific instructions provided for this individual task.";

  const handleUpdateLog = async () => {
    if (!localDesc.trim()) return;
    try {
      const newLog = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        progressPoint: localProgress,
        logText: localDesc,
        authorName: crmUser?.name || "Team Member",
        authorUid: crmUser?.uid || "",
        authorRole: crmUser?.role || "employee"
      };
      await updateDoc(doc(db, "tasks", task.id), { 
        activityLogs: arrayUnion(newLog)
      });

      // Create notification for the other party
      const recipientUid = crmUser?.uid === task.assignedTo ? task.assignedBy : task.assignedTo;
      if (recipientUid) {
        await addDoc(collection(db, "notifications"), {
          userId: recipientUid,
          title: "New Message",
          message: `${crmUser?.name} sent a message on task: ${task.title}`,
          link: `/tasks/${task.id}?tab=chat`,
          read: false,
          createdAt: new Date().toISOString(),
          type: "new-message"
        });
      }

      setLocalDesc("");
    } catch (err) {
      console.error(err);
      alert("Failed to commit message.");
    }
  };

  const handleSaveLogEdit = async (logId: string) => {
    if (!editingLogText.trim()) return;
    try {
      const updatedLogs = task.activityLogs.map((log: any) => {
        if (log.id === logId) {
          return {
            ...log,
            logText: editingLogText,
            isEdited: true,
            editedAt: new Date().toISOString()
          };
        }
        return log;
      });
      await updateDoc(doc(db, "tasks", task.id), {
        activityLogs: updatedLogs
      });
      setEditingLogId(null);
      setEditingLogText("");
    } catch (err) {
      console.error(err);
      alert("Failed to update log.");
    }
  };

  const handleProgressClick = async (newProgress: number) => {
    if (crmUser?.role === "admin" && task.assignedTo !== crmUser?.uid) {
      alert("Action Restricted: Admins cannot update an employee's progress on their tasks.");
      return;
    }
    setLocalProgress(newProgress);
    
    let newStatus = "not-started";
    if (newProgress === 25) newStatus = "dev";
    else if (newProgress === 50) newStatus = "test";
    else if (newProgress === 75) newStatus = "review";
    else if (newProgress === 100) newStatus = "completed";

    await updateDoc(doc(db, "tasks", task.id), { 
      progress: newProgress,
      status: newStatus,
      done: newProgress === 100
    });

    // Notify assignedBy when assignedTo updates progress
    if (crmUser?.uid === task.assignedTo && task.assignedBy) {
      await addDoc(collection(db, "notifications"), {
        userId: task.assignedBy,
        title: "Task Progress Updated",
        message: `${crmUser?.name} updated task progress to ${newProgress}% on: ${task.title}`,
        link: `/tasks/${task.id}`,
        read: false,
        createdAt: new Date().toISOString(),
        type: "system"
      });
    }
    
    if (task.relatedType === "project" && task.relatedTo) {
      const q = query(collection(db, "tasks"), where("relatedTo", "==", task.relatedTo));
      const snap = await getDocs(q);
      let total = 0; let count = 0;
      snap.forEach(d => {
         total += d.id === task.id ? newProgress : (d.data().progress || 0);
         count++;
      });
      const projProgress = count === 0 ? 0 : Math.round(total / count);
      await updateDoc(doc(db, "projects", task.relatedTo), { 
        progress: projProgress, 
        updatedAt: new Date().toISOString() 
      });
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-10">
      <div className="max-w-[1000px] mx-auto p-6 md:p-8">
        
        {/* Header Strip */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center gap-4 mb-4 md:mb-0">

            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors font-black border border-slate-200"
            >

              ←
            </button>
            <div>
              <h1 className="text-2xl font-black text-[#0D1B3E] tracking-tight">{task.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-blue-200 flex items-center justify-center text-[7px] text-blue-700">
                    {task.assignedToName ? task.assignedToName.charAt(0) : "?"}
                  </div>
                  {task.assignedToName || "Unassigned"}
                </span>
                {task.dueDate && (
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg tracking-widest border bg-amber-50 text-amber-600 border-amber-200">
                    <Target className="inline-block w-4 h-4 shrink-0 mr-1" /> Due: {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg tracking-widest border bg-slate-50 text-slate-500 border-slate-200">
                  {task.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Global View Navigation Toggles */}
        <div className="flex space-x-2 border-b-2 border-slate-200 mb-8 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab("blueprints")}
            className={`px-6 py-4 font-black tracking-widest uppercase text-[11px] transition-all whitespace-nowrap rounded-t-xl ${
              activeTab === "blueprints" 
                ? "text-blue-600 border-b-4 border-blue-600 bg-blue-50/50" 
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Clipboard className="inline-block w-4 h-4 shrink-0 mr-1" /> Instructions & Blueprints
          </button>
          <button 
            onClick={() => setActiveTab("chat")}
            className={`px-6 py-4 font-black tracking-widest uppercase text-[11px] transition-all whitespace-nowrap rounded-t-xl ${
              activeTab === "chat" 
                ? "text-[#C9A84C] border-b-4 border-[#C9A84C] bg-amber-50/30" 
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <MessageSquare className="inline-block w-4 h-4 shrink-0 mr-1" /> Progress & Communication Hub
          </button>
        </div>

        {/* Tab Panel A: The Blueprint Matrix */}
        <AnimatePresence mode="wait">
          {activeTab === "blueprints" && (
            <motion.div 
              key="blueprints"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-6 flex-1 pr-2">
                {/* Project Master Blueprint */}
                {projectBlueprint && (
                  <div>
                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      {"// Project Master Blueprint"}
                    </h4>
                    <div className="bg-amber-50/60 p-6 rounded-2xl border border-amber-200/70 shadow-inner mb-6">
                      <p className="text-[14px] text-slate-800 leading-loose whitespace-pre-wrap font-medium">
                        {projectBlueprint}
                      </p>
                    </div>
                  </div>
                )}

                {/* Project Lead Dynamic Instructions */}
                {leadInstructions && (
                  <div>
                    <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                      {"// Project Lead Directives & Standing Orders"}
                    </h4>
                    <div className="bg-purple-50/60 p-6 rounded-2xl border border-purple-200/70 shadow-inner mb-6">
                      <p className="text-[14px] text-purple-950 leading-loose whitespace-pre-wrap font-semibold">
                        {leadInstructions}
                      </p>
                    </div>
                  </div>
                )}

                {/* Specific Task Instructions */}
                <div>
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    {"// Specific Task Assignment Instructions"}
                  </h4>
                  <div className="bg-blue-50/60 p-6 rounded-2xl border border-blue-200/70 shadow-inner">
                    <p className="text-[14px] text-slate-800 leading-loose whitespace-pre-wrap font-medium">
                      {taskInstructions}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tab Panel B: The Team Progress Stream */}
          {activeTab === "chat" && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="flex flex-col h-[700px] bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative"
            >
              {/* Top Milestone Tracker embedded in Chat Header */}
              <div className="bg-slate-50 border-b border-slate-200 p-5 shrink-0 z-10 shadow-sm relative">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                   Active Milestone Pipeline
                </h4>
                <div className="relative h-14 w-full bg-white p-3 rounded-2xl border border-slate-100 shadow-inner flex items-center justify-between px-6">
                  <div className="absolute left-8 right-8 h-1.5 bg-slate-100 top-1/2 -translate-y-1/2 rounded-full" />
                  <div 
                    className="absolute left-8 h-1.5 bg-gradient-to-r from-blue-400 to-blue-600 top-1/2 -translate-y-1/2 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(59,130,246,0.6)]"
                    style={{ width: `calc(${localProgress}% - ${localProgress === 100 ? 4 : localProgress === 0 ? 0 : 2}rem)` }}
                  />
                  {
                    [
                      { pct: 0, label: "START" },
                      { pct: 25, label: "DEV" },
                      { pct: 50, label: "TEST" },
                      { pct: 75, label: "REVIEW" },
                      { pct: 100, label: "DONE" }
                    ].map((step) => {
                      const isCompleted = localProgress >= step.pct;
                      return (
                        <div key={step.pct} className="flex flex-col items-center gap-2 relative z-10">
                          <button
                            onClick={() => handleProgressClick(step.pct)}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black transition-all duration-500 shadow-sm ${
                              isCompleted 
                                ? "bg-[#0D1B3E] text-[#C9A84C] border border-[#C9A84C] scale-110" 
                                : "bg-white text-slate-400 border border-slate-200 hover:scale-105"
                            }`}
                          >
                            {step.pct === 100 && isCompleted ? <Check className="inline-block w-4 h-4 shrink-0 mr-1" /> : step.pct === 0 ? <Rocket className="inline-block w-4 h-4 shrink-0 mr-1" /> : step.pct}
                          </button>
                          <span className={`text-[8px] font-black tracking-widest uppercase absolute -bottom-6 whitespace-nowrap ${isCompleted ? "text-[#0D1B3E]" : "text-slate-400"}`}>
                            {step.label}
                          </span>
                        </div>
                      );
                  })}
                </div>
              </div>

              {/* The Chat Timeline Feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-100/50">
                {(!task.activityLogs || task.activityLogs.length === 0) ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-slate-300 mb-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      <p className="text-slate-400 text-sm font-medium">The communication hub is silent.</p>
                      <p className="text-slate-400 text-xs mt-1">Send the first update to alert the team.</p>
                    </div>
                  </div>
                ) : (
                  task.activityLogs.map((log: any) => {
                    const isMine = log.authorUid === crmUser.uid;
                    const isManager = log.authorRole === "admin" || log.authorRole === "lead";

                    return (
                      <div key={log.id} className={`flex flex-col w-full ${isMine ? "items-end" : "items-start"}`}>
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{isMine ? "You" : log.authorName}</span>
                          <span className="text-[9px] font-bold text-slate-400">
                            {new Date(log.timestamp).toLocaleTimeString("en-US", { hour: '2-digit', minute:'2-digit' })}
                          </span>
                        </div>
                        
                        <div 
                          className={`relative group max-w-[85%] md:max-w-[70%] p-4 rounded-2xl shadow-sm border ${
                            isMine 
                              ? "bg-blue-600 text-white rounded-tr-sm border-blue-700" 
                              : isManager 
                                ? "bg-[#0D1B3E] text-white rounded-tl-sm border-slate-800 shadow-md"
                                : "bg-white text-slate-700 rounded-tl-sm border-slate-200"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-4 mb-2">
                             <span className={`text-[9px] font-black px-2 py-0.5 rounded shadow-sm flex items-center gap-1 ${
                               isMine ? "bg-blue-500 text-blue-50" : isManager ? "bg-amber-500/20 text-amber-400" : "bg-slate-100 text-slate-500"
                             }`}>
                               <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"></circle></svg>
                               MILESTONE: {log.progressPoint}%
                             </span>
                             {isMine && editingLogId !== log.id && (
                               <button 
                                 onClick={() => { setEditingLogId(log.id); setEditingLogText(log.logText); }}
                                 className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold text-blue-200 hover:text-white underline"
                               >
                                 Edit
                               </button>
                             )}
                          </div>

                          {editingLogId === log.id ? (
                            <div className="mt-2 flex flex-col gap-2 min-w-[250px]">
                              <textarea
                                value={editingLogText}
                                onChange={(e) => setEditingLogText(e.target.value)}
                                className="w-full text-[12px] p-2 rounded border border-blue-400/50 bg-blue-700/50 text-white placeholder-blue-300 outline-none min-h-[60px] resize-none"
                              />
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditingLogId(null)} className="px-2 py-1 rounded bg-blue-800 text-[10px] font-bold hover:bg-blue-900 transition-colors">Cancel</button>
                                <button onClick={() => handleSaveLogEdit(log.id)} disabled={!editingLogText.trim()} className="px-2 py-1 rounded bg-white text-blue-600 text-[10px] font-bold hover:bg-blue-50 transition-colors">Save</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[13px] leading-relaxed whitespace-pre-line font-medium">
                              {log.logText}
                            </p>
                          )}
                          
                          {log.isEdited && (
                            <div className={`text-[8px] font-bold italic mt-2 text-right ${isMine ? "text-blue-300" : "text-slate-400"}`}>
                              (edited)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* The Bottom Communication Bar */}
              <div className="bg-white p-4 border-t border-slate-200 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] z-10">
                <div className="flex items-end gap-3 max-w-4xl mx-auto">
                  <textarea 
                    rows={1}
                    value={localDesc}
                    onChange={(e) => setLocalDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleUpdateLog();
                      }
                    }}
                    placeholder="Type an update or instruction... (Press Enter to send)"
                    className="flex-1 resize-none bg-slate-100 text-slate-800 text-sm p-4 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-500/50 transition-all max-h-[120px]"
                    style={{ minHeight: "56px" }}
                  />
                  <button 
                    onClick={handleUpdateLog}
                    disabled={!localDesc.trim()}
                    className="w-14 h-14 shrink-0 rounded-2xl bg-[#0D1B3E] text-white flex items-center justify-center hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
