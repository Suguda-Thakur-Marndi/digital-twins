const fs = require('fs');
const path = require('path');

const esmPath = path.join(__dirname, '..', 'node_modules', '@react-three', 'drei', 'web', 'Html.js');
const cjsPath = path.join(__dirname, '..', 'node_modules', '@react-three', 'drei', 'web', 'Html.cjs.js');

try {
  if (fs.existsSync(esmPath)) {
    let content = fs.readFileSync(esmPath, 'utf8');
    let modified = false;

    if (content.includes('if (target) target.removeChild(el);')) {
      content = content.replace(
        'if (target) target.removeChild(el);',
        'if (target && el.parentNode === target) target.removeChild(el);'
      );
      modified = true;
    }

    if (content.includes('currentRoot.unmount();') && !content.includes('setTimeout(() => {\n          currentRoot.unmount();')) {
      content = content.replace(
        'currentRoot.unmount();',
        'setTimeout(() => {\n          currentRoot.unmount();\n        }, 0);'
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(esmPath, content, 'utf8');
      console.log('Successfully patched @react-three/drei Html.js for React 19');
    }
  }

  if (fs.existsSync(cjsPath)) {
    let content = fs.readFileSync(cjsPath, 'utf8');
    let modified = false;

    if (content.includes('U&&U.removeChild(D),e.unmount()')) {
      content = content.replace(
        'U&&U.removeChild(D),e.unmount()',
        'U&&D.parentNode===U&&U.removeChild(D),setTimeout(()=>{e.unmount()},0)'
      );
      modified = true;
    } else if (content.includes('U&&U.removeChild(D)')) {
      content = content.replace('U&&U.removeChild(D)', 'U&&D.parentNode===U&&U.removeChild(D)');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(cjsPath, content, 'utf8');
      console.log('Successfully patched @react-three/drei Html.cjs.js for React 19');
    }
  }
} catch (err) {
  console.warn('Warning: Could not patch @react-three/drei:', err.message);
}
