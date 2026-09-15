const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/tasks/[id]/page.tsx', 'utf-8');

const regex = /if\s*\(crmUser\?\.role === "admin" && \!\(Array\.isArray\(task\.assignedTo\) \? task\.assignedTo\.includes\(crmUser\?\.uid\) : task\.assignedTo === crmUser\?\.uid\)\)\s*\{\s*alert\("Action Restricted: Admins cannot update an employee's progress on their tasks\."\);\s*return;\s*\}/g;

code = code.replace(regex, '');

fs.writeFileSync('app/(dashboard)/tasks/[id]/page.tsx', code);
console.log("Done");
