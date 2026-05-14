import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, '../../src/App.tsx');
const orig = fs.readFileSync(appPath, 'utf8');

const ranges = [];
function add(startN, endN) {
  const a = orig.indexOf(startN);
  const b = orig.indexOf(endN, a);
  if (a === -1 || b === -1) {
    throw new Error(`strip: missing ${startN} .. ${endN}`);
  }
  ranges.push([a, b]);
}

add('function ArtisanDashboard(', '\n\nexport default App');
add('function ArtisanProfilePage(', '\n\nfunction AppPromo(');
add('const helpTopics = ', '\n\nfunction AccountSettingsPanel(');
add('function LoggedInHome(', '\n\nfunction Hero(');
add('function AuthBox(', '\n\nfunction categoryIcon(');

ranges.sort((x, y) => y[0] - x[0]);
let out = orig;
for (const [a, b] of ranges) {
  out = out.slice(0, a) + out.slice(b);
}

fs.writeFileSync(appPath, out);
console.log('Stripped App.tsx, new length', out.length);
