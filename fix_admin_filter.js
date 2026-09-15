const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/projects/[id]/page.tsx', 'utf-8');

code = code.replace(/\.filter\(u => u\.role !== "admin"\)/g, '');

fs.writeFileSync('app/(dashboard)/projects/[id]/page.tsx', code);
console.log("Done");
