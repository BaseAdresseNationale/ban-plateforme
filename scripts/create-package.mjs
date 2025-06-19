#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Charger les variables d'env si présentes
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const slugify = (str) => str.replace(/[-\s]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

const DEFAULT_SCOPE = process.env.SCOPE || 'tonscope';

const main = async () => {
  const { type } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Type de package à créer :',
      choices: ['lib', 'app']
    }
  ]);

  const { name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: type === 'lib' ? 'Nom du module :' : 'Nom de l’application :',
      validate(input) {
        return /^[a-z][a-z0-9-_]+$/.test(input)
          ? true
          : 'Utiliser uniquement des lettres minuscules, tirets ou underscores (ex: ma-lib)';
      }
    }
  ]);

  let scope = DEFAULT_SCOPE;
  if (type === 'lib') {
    const scopePrompt = await inquirer.prompt([
      {
        type: 'input',
        name: 'scope',
        message: "Nom du scope (sans le @) :",
        default: DEFAULT_SCOPE,
        validate(input) {
          return /^[a-z0-9-]+$/.test(input) ? true : 'Le scope ne doit contenir que des lettres, chiffres ou tirets';
        }
      }
    ]);
    scope = scopePrompt.scope;
  }

  const baseDir = type === 'app' ? 'apps' : 'packages';
  const dirPath = path.join(__dirname, '..', baseDir, name);

  if (fs.existsSync(dirPath)) {
    console.error(`❌ Le dossier ${dirPath} existe déjà.`);
    process.exit(1);
  }

  fs.mkdirSync(path.join(dirPath, 'src'), { recursive: true });

  // Génère package.json
  const isLib = type === 'lib';
  const pkg = {
    name: isLib ? `@${scope}/${name}` : name,
    version: '1.0.0',
    type: 'module',
    main: isLib ? 'dist/index.js' : 'src/index.ts',
    types: isLib ? 'dist/index.d.ts' : undefined,
    files: isLib ? ['dist'] : undefined,
    scripts: isLib
      ? {
          build: 'tsc',
          dev: 'tsc -w',
          preinstall: 'node ../../scripts/check-root.cjs'
        }
      : { dev: 'echo "dev script à définir"' }
  };
  fs.writeFileSync(path.join(dirPath, 'package.json'), JSON.stringify(pkg, null, 2));

  // tsconfig.json
  const tsconfig = {
    extends: '../../tsconfig.json',
    compilerOptions: {
      outDir: 'dist'
    },
    include: ['src']
  };
  fs.writeFileSync(path.join(dirPath, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

  // index.ts
  const ident = slugify(name);
  const code = isLib
    ? `export const ${ident} = () => 'Hello from ${name}';\n`
    : `import { greet } from '@${scope}/shared-lib';\n\nconsole.log(greet());\n`;
  fs.writeFileSync(path.join(dirPath, 'src/index.ts'), code);

  // Test
  const test = `import { describe, it, expect } from 'vitest';\n\ndescribe('${name}', () => {\n  it('should work', () => {\n    expect(1 + 1).toBe(2);\n  });\n});\n`;
  fs.writeFileSync(path.join(dirPath, `src/${name}.test.ts`), test);

  // Sync references
  const syncScript = path.join(__dirname, 'sync-references.cjs');
  if (fs.existsSync(syncScript)) {
    execSync('node scripts/sync-references.cjs', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  }

  console.log(`\n✅ ${type} '${name}' créé dans '${baseDir}/' avec le scope @${scope}`);
};

main();
