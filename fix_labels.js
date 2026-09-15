const fs = require('fs');

let idPage = fs.readFileSync('app/(dashboard)/projects/[id]/page.tsx', 'utf-8');
idPage = idPage.replace('Select Employee Assets (Multiple) *', 'Select Employee Asset *');
fs.writeFileSync('app/(dashboard)/projects/[id]/page.tsx', idPage);

let projPage = fs.readFileSync('app/(dashboard)/projects/page.tsx', 'utf-8');
projPage = projPage.replace(/Assign To \(Multiple\) \*/g, 'Assign To *');
fs.writeFileSync('app/(dashboard)/projects/page.tsx', projPage);

let taskPage = fs.readFileSync('app/(dashboard)/tasks/page.tsx', 'utf-8');
taskPage = taskPage.replace('Owners (Multiple)', 'Owners');
fs.writeFileSync('app/(dashboard)/tasks/page.tsx', taskPage);

console.log("Labels fixed");
