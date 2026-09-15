const fs = require('fs');
let code = fs.readFileSync('app/(dashboard)/dashboard/page.tsx', 'utf-8');

const regex = /<Link href=\{`\/tasks\/\$\{t\.id\}`\} key=\{t\.id\} className="flex justify-between items-center text-xs p-2 bg-red-50 hover:bg-red-100 transition-colors rounded-lg cursor-pointer">/g;

const newLink = `<Link href={t.relatedType === 'project' && t.relatedTo ? \`/projects/\${t.relatedTo}\` : \`/tasks\`} key={t.id} className="flex justify-between items-center text-xs p-2 bg-red-50 hover:bg-red-100 transition-colors rounded-lg cursor-pointer">`;

code = code.replace(regex, newLink);

fs.writeFileSync('app/(dashboard)/dashboard/page.tsx', code);
console.log("Done");
