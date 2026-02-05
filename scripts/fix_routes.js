
import fs from 'fs';
const path = 'apps/api/src/features/credentials/routes.js';
let content = fs.readFileSync(path, 'utf8');

const marker = '// Lock/Unlock Routes (Story 2.9)';
const parts = content.split(marker);

if (parts.length < 2) {
    console.log("Marker not found, maybe already fixed?");
    process.exit(1);
}

let prefix = parts[0];
const suffix = parts.slice(1).join(marker);

// Find the last closing brace in the prefix
const lastBraceIndex = prefix.lastIndexOf('}');
if (lastBraceIndex === -1) {
    console.error("Could not find closing brace in prefix");
    process.exit(1);
}

const beforeBrace = prefix.substring(0, lastBraceIndex);
// We ignore what's after the brace in prefix (likely newlines) because we are reconstructing the file

const newContent = beforeBrace + '\n    ' + marker + suffix + '\n}';

fs.writeFileSync(path, newContent);
console.log("Fixed routes.js");
