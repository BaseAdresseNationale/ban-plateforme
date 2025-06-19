#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ROOT = process.cwd();
const APPS_DIR = path.join(ROOT, 'apps');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const TSCONFIG_PATH = path.join(ROOT, 'tsconfig.json');
const INTERNAL_SCOPE = '@tonscope/';

// 📁 Récupère toutes les libs internes
function getLocalLibs() {
  return fs.readdirSync(PACKAGES_DIR)
    .filter((dir) => fs.existsSync(path.join(PACKAGES_DIR, dir, 'package.json')))
    .map((dir) => {
      const pkgPath = path.join(PACKAGES_DIR, dir, 'package.json');
      const { name } = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return { name, path: `./packages/${dir}` };
    });
}

// 🔄 Met à jour tsconfig.json#references
function updateRootTsConfig(references) {
  const tsconfig = JSON.parse(fs.readFileSync(TSCONFIG_PATH, 'utf-8'));
  tsconfig.references = references.sort((a, b) => a.path.localeCompare(b.path));
  fs.writeFileSync(TSCONFIG_PATH, JSON.stringify(tsconfig, null, 2));
}

// 📚 Scan des imports d’un fichier
function extractImports(fileContent) {
  const matches = [...fileContent.matchAll(/from ['"](@tonscope\/[^'"]+)['"]/g)];
  return matches.map((m) => m[1]);
}

// 🧠 Ajoute les dépendances manquantes
function updateAppDependencies(appDir, detectedDeps) {
  const pkgPath = path.join(appDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  pkg.dependencies = pkg.dependencies || {};
  let modified = false;
  let addedDeps = [];

  detectedDeps.forEach((dep) => {
    if (!pkg.dependencies[dep]) {
      pkg.dependencies[dep] = '*';
      addedDeps.push(dep);
      modified = true;
    }
  });

  if (modified) {
    totalAdded += addedDeps.length;
    console.log(`📦 ${path.relative(ROOT, pkgPath)} → + ${addedDeps.join(', ')}`);
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  }
}

// 🚀 MAIN
const references = [];
const libs = getLocalLibs();

// Ajout de toutes les libs dans tsconfig.references
references.push(...libs.map((lib) => ({ path: lib.path })));

// Ajout aussi des apps
const apps = fs.readdirSync(APPS_DIR).filter((dir) => fs.existsSync(path.join(APPS_DIR, dir, 'tsconfig.json')));
references.push(...apps.map((dir) => ({ path: `./apps/${dir}` })));

// Mise à jour tsconfig.json racine
updateRootTsConfig(references);

// Pour chaque app : parser les imports et enrichir package.json
let totalAdded = 0;
apps.forEach((dir) => {
  const appPath = path.join(APPS_DIR, dir);
  const srcPath = path.join(appPath, 'src');

  if (!fs.existsSync(srcPath)) return;

  const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const res = path.resolve(dir, entry.name);
    return entry.isDirectory() ? walk(res) : res;
  });

const files = walk(srcPath).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

  const detectedImports = new Set();

  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    extractImports(content)
      .filter((i) => i.startsWith(INTERNAL_SCOPE))
      .forEach((i) => detectedImports.add(i));
  });

  updateAppDependencies(appPath, [...detectedImports]);
});


// ✅ Résumé final
console.log(`\n✅ ${libs.length} lib(s) référencée(s) dans tsconfig.json`);
console.log(`✅ ${apps.length} app(s) analysée(s) pour les imports internes`);
console.log(`🔧 ${totalAdded} dépendance(s) ajoutée(s) au total`);
