const fs = require('fs');
const file = 'apps/web/src/components/DetailsDialog.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /(<h4 className="text-\[10px\] uppercase tracking-widest text-surface-500 font-semibold mb-2">Access Control<\/h4>)[\s\S]*?(<div className="flex flex-col items-center justify-center py-8 text-center">[\s\S]*?<\/div>)\n\s*\}\)/;
// Wait, regex replace might be brittle. Let's just do precise replacement.
