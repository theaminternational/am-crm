const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/tasks/page.tsx', 'utf-8');

const regex = /if\s*\(crmUser\?\.role === "admin" &&[^)]+\)[^}]+\}\s*alert\("Action Restricted:[^"]+"\);\s*return;\s*\}/g;
// Actually just replace the block manually.
code = code.replace(
  'if (crmUser?.role === "admin" && !(Array.isArray(task.assignedTo) ? task.assignedTo.includes(crmUser?.uid) : task.assignedTo === crmUser?.uid)) {\n      alert("Action Restricted: Admins cannot update an employee\'s progress on their tasks.");\n      return;\n    }',
  ''
);

code = code.replace(
  'if (crmUser?.role === "admin" && !(Array.isArray(task.assignedTo) ? task.assignedTo.includes(crmUser?.uid) : task.assignedTo === crmUser?.uid)) {\n      alert("Action Restricted: Admins cannot update an employee\'s progress on their tasks.");\n      return;\n    }',
  ''
);

fs.writeFileSync('app/(dashboard)/tasks/page.tsx', code);
console.log("Done tasks/page.tsx");
