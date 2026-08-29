const fs = require('fs');
const file = 'apps/api/src/modules/file-requests/routes.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /size: BigInt\(Math\.ceil\(size\)\),\n            }/g,
    `size: BigInt(Math.ceil(size)),\n                sha256Hash: sha256Hash || ''\n            }`
);

fs.writeFileSync(file, content);
