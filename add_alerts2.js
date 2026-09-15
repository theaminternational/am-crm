const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/tasks/[id]/page.tsx', 'utf-8');

code = code.replace(
  /const handleProgressClick = async \(newProgress: number\) => \{\s*setLocalProgress\(newProgress\);/,
  'const handleProgressClick = async (newProgress: number) => {\n    if (crmUser?.role === "admin" && !(Array.isArray(task.assignedTo) ? task.assignedTo.includes(crmUser?.uid) : task.assignedTo === crmUser?.uid)) {\n      alert("Action Restricted: As an admin, please allow the assigned project managers and employees to update their own task progress.");\n      return;\n    }\n    setLocalProgress(newProgress);'
);

fs.writeFileSync('app/(dashboard)/tasks/[id]/page.tsx', code);
console.log("Done tasks/[id]/page.tsx");
