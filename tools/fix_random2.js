const fs = require('fs');

const files = [
  'components/ui/Input.tsx',
  'components/ui/Select.tsx',
  'components/ui/Textarea.tsx',
  'components/ui/Checkbox.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/Math\.random\(\)/g, "Date.now().toString(36)");
    fs.writeFileSync(f, content, 'utf8');
  }
});

const deanFile = 'app/dean/evaluation-setup/page.tsx';
if (fs.existsSync(deanFile)) {
  let content = fs.readFileSync(deanFile, 'utf8');
  content = content.replace(/Math\.random\(\)\.toString\(36\)\.slice\(2, 9\)/g, "Date.now().toString(36)");
  fs.writeFileSync(deanFile, content, 'utf8');
}
console.log('Fixed random successfully');
