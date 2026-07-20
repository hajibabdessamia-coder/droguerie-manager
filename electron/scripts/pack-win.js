// Packaging wrapper: backend/node_modules ships to customers as-is via
// extraResources (see package.json), so it must not contain devDependencies
// (jest, typescript, ts-node, @nestjs/cli, prisma CLI, ...) — none of that is
// needed to run the already-compiled dist/src/main.js, and it was bloating
// every distributable (installer, zip, portable) with tens of thousands of
// files that don't belong in a shipped product. `npm prune --omit=dev` is
// destructive to the working tree, so it's always paired with a matching
// `npm install` in `finally`, even if packaging itself fails.
const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, '..', '..', 'backend');
const electronDir = path.join(__dirname, '..');

function run(cmd, cwd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
}

try {
  run('npm prune --omit=dev', backendDir);
  run('npx electron-builder --win nsis zip', electronDir);
} finally {
  run('npm install', backendDir);
}
