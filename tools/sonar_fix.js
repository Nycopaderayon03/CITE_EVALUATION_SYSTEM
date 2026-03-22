const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.next')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = [...walk('app'), ...walk('lib'), ...walk('components'), ...walk('hooks'), ...walk('context')];

let securityFixes = 0;
let reliabilityFixes = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Security: Remove hardcoded 'secret'
    if (content.includes("process.env.JWT_SECRET || 'secret'")) {
        content = content.replace(/process\.env\.JWT_SECRET \|\| 'secret'/g, "process.env.JWT_SECRET as string");
        securityFixes++;
    }

    // Reliability: Fix empty catch blocks `catch {}` -> `catch (err) { console.error(err); }`
    if (content.includes("catch {}")) {
        content = content.replace(/catch\s*\{\s*\}/g, "catch (err) { console.error('Error:', err); }");
        reliabilityFixes++;
    }
    
    // Reliability: Fix `catch(() => {})`
    if (content.includes("catch(() => {})")) {
        content = content.replace(/catch\(\(\) => \{\}\)/g, "catch((err) => { console.error('Error:', err); })");
        reliabilityFixes++;
    }

    // Reliability: Fix `.catch(() => { })`
    if (content.includes("catch(() => { })")) {
        content = content.replace(/catch\(\(\) => \{ \}\)/g, "catch((err) => { console.error('Error:', err); })");
        reliabilityFixes++;
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
    }
});

console.log(`Security Fixes: ${securityFixes}`);
console.log(`Reliability Fixes: ${reliabilityFixes}`);
