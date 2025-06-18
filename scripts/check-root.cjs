const { resolveWorkspaceRoot } = require("resolve-workspace-root");

const cwd = process.cwd();
const root = resolveWorkspaceRoot();
const initCwd = process.env.INIT_CWD;

const isCalledFromRoot = initCwd === root;

if (cwd !== root && !isCalledFromRoot) {
  console.error(`
🚫 [Monorepo] Ne pas exécuter 'npm install' ici !
→ Utilise 'npm install' uniquement à la racine du repo : ${root}
(Tu es actuellement dans : ${cwd})
`);
  process.exit(1);
}
