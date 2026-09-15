const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/tasks/[id]/page.tsx', 'utf-8');
code = code.replace(
  'if (crmUser?.role === "admin" && task.assignedTo !== crmUser?.uid)',
  'if (crmUser?.role === "admin" && !(Array.isArray(task.assignedTo) ? task.assignedTo.includes(crmUser?.uid) : task.assignedTo === crmUser?.uid))'
);
fs.writeFileSync('app/(dashboard)/tasks/[id]/page.tsx', code);
console.log("Done");
