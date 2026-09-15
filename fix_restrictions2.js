const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/tasks/[id]/page.tsx', 'utf-8');

// Remove restriction from handleProgressClick
code = code.replace(
  /if \(crmUser\?\.role === "admin" && !\([^)]+\)\) \{\s*alert\("Action Restricted:[^"]+"\);\s*return;\s*\}/g,
  ''
);

fs.writeFileSync('app/(dashboard)/tasks/[id]/page.tsx', code);
console.log("Done tasks/[id]/page.tsx");
