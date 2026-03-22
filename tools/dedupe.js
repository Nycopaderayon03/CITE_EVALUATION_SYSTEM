const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            results = results.concat(walk(fullPath));
        } else if (fullPath.endsWith('route.ts')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walk('app/api');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Pattern to aggressively match and remove the duplicated block:
    const regex = /let jwt:\s*any\s*=\s*null;[\s\S]*?catch \((err|error)\) \{\s*if \((err|error)\) console\.debug\('JWT error'\);\s*return null;\s*\}\s*\}/g;
    
    if (regex.test(content)) {
        content = content.replace(regex, '');
        
        // Add import at the top
        if (!content.includes('@/lib/auth')) {
             if (content.startsWith('import')) {
                 // Insert after imports
                 content = content.replace(/^(import.*?\n)+/m, match => match + "import { verifyToken, getAuthToken } from '@/lib/auth';\n");
             } else {
                 content = "import { verifyToken, getAuthToken } from '@/lib/auth';\n" + content;
             }
        }
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
    }
});

console.log('Duplication scrubbed!');
