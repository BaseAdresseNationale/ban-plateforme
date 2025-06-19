const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const APPS_DIR = path.join(ROOT, 'apps');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const NAMESPACE = '@tonscope/';

function getLocalLibs() {
  const libs = {};
  fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .forEach(dirent => {
      const pkgPath = path.join(PACKAGES_DIR, dirent.name, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath));
        libs[pkg.name] = `../../packages/${dirent.name}`;
      }
    });
  return libs;
}

function updateTsconfig(appDir, usedLibs, libPaths) {
  const tsconfigPath = path.join(appDir, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) return;

  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath));
  tsconfig.references = tsconfig.references || [];

  const existing = new Set(tsconfig.references.map(r => r.path));
  let changed = false;

  usedLibs.forEach(lib => {
    const refPath = libPaths[lib];
    if (!existing.has(refPath)) {
      tsconfig.references.push({ path: refPath });
      changed = true;
    }
  });

  if (changed) {
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n');
    console.log(`✅ tsconfig updated: ${tsconfigPath}`);
  }
}

const libPaths = getLocalLibs();

fs.readdirSync(APPS_DIR, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .forEach(dirent => {
    const appDir = path.join(APPS_DIR, dirent.name);
    const pkgPath = path.join(appDir, 'package.json');
    if (!fs.existsSync(pkgPath)) return;

    const pkg = JSON.parse(fs.readFileSync(pkgPath));
    const deps = pkg.dependencies || {};
    const usedLibs = Object.keys(deps).filter(d => d.startsWith(NAMESPACE) && libPaths[d]);

    updateTsconfig(appDir, usedLibs, libPaths);
});