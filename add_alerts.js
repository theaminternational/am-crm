const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/tasks/page.tsx', 'utf-8');

code = code.replace(
  /async function toggleDone\(task: any\) \{\s*const newStatus = task\.status === "completed" \? "in-progress" : "completed";/,
  'async function toggleDone(task: any) {\n    if (crmUser?.role === "admin" && !(Array.isArray(task.assignedTo) ? task.assignedTo.includes(crmUser?.uid) : task.assignedTo === crmUser?.uid)) {\n      alert("Action Restricted: As an admin, please allow the assigned project managers and employees to update their own task progress.");\n      return;\n    }\n    const newStatus = task.status === "completed" ? "in-progress" : "completed";'
);

code = code.replace(
  /async function updateStatus\(task: any, status: string\) \{\s*await PipelineService\.handleTaskStatusUpdate/,
  'async function updateStatus(task: any, status: string) {\n    if (crmUser?.role === "admin" && !(Array.isArray(task.assignedTo) ? task.assignedTo.includes(crmUser?.uid) : task.assignedTo === crmUser?.uid)) {\n      alert("Action Restricted: As an admin, please allow the assigned project managers and employees to update their own task progress.");\n      return;\n    }\n    await PipelineService.handleTaskStatusUpdate'
);

fs.writeFileSync('app/(dashboard)/tasks/page.tsx', code);
console.log("Done tasks/page.tsx");
