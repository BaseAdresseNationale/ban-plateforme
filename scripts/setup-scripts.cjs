const fs = require('fs');
const path = require('path');

const WORKSPACE_FOLDERS = ['apps', 'packages'];
const CHECK_SCRIPT = 'node ../../check-root.cjs';

function updatePackageJson(pkgPath) {
  const content = fs.readFileSync(pkgPath, 'utf-8');
  const json = JSON.parse(content);

  json.scripts = json.scripts || {};

  const existing = json.scripts.preinstall;

  if (existing && existing.includes('check-root.cjs')) {
    console.log(`✔️  Déjà OK : ${pkgPath}`);
    return;
  }

  if (existing) {
    // Concatène intelligemment
    json.scripts.preinstall = `${existing} && ${CHECK_SCRIPT}`;
    console.log(`🛠️  Patché (ajout à l'existant): ${pkgPath}`);
  } else {
    // Ajoute le script
    json.scripts.preinstall = CHECK_SCRIPT;
    console.log(`➕ Ajouté : ${pkgPath}`);
  }

  fs.writeFileSync(pkgPath, JSON.stringify(json, null, 2) + '\n');
}

for (const folder of WORKSPACE_FOLDERS) {
  const absFolder = path.join(__dirname, folder);
  if (!fs.existsSync(absFolder)) continue;

  const workspaces = fs.readdirSync(absFolder, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(absFolder, entry.name, 'package.json'))
    .filter(pkgPath => fs.existsSync(pkgPath));

  workspaces.forEach(updatePackageJson);
}

console.log('✅ Tous les workspaces ont été vérifiés pour le script "preinstall".');
