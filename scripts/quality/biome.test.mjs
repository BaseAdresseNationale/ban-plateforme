import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const cli = path.join(root, 'node_modules/@biomejs/biome/bin/biome')

function fixture(t, source) {
  const directory = fs.mkdtempSync(path.join(root, 'scripts/quality/.biome-test-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'example.ts')
  fs.writeFileSync(file, source)
  return file
}

function biome(command, file, ...options) {
  const result = spawnSync(process.execPath, [cli, command, ...options, file], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
  })
  assert.ifError(result.error)
  return { ...result, diagnostics: result.stdout + result.stderr }
}

test('imports follow Node, external, workspace and local groups with the agreed style', (t) => {
  const file = fixture(
    t,
    `import local from "./local.js";
import { normalizeExportSelection, logger } from "@ban/tools";
import express from "express";
import path from "node:path";
import fs from "node:fs";
export { express, fs, local, logger, normalizeExportSelection, path };
`,
  )

  const result = biome('check', file, '--write')
  assert.equal(result.status, 0, result.diagnostics)
  const formatted = fs.readFileSync(file, 'utf8')
  assert.match(
    formatted,
    /import fs from 'node:fs'\nimport path from 'node:path'\n\nimport express from 'express'\n\nimport \{ logger, normalizeExportSelection \} from '@ban\/tools'\n\nimport local from '\.\/local.js'/,
  )
  assert.equal(biome('ci', file).status, 0)
})

test('side-effect imports remain barriers to import sorting', (t) => {
  const file = fixture(
    t,
    `import 'dotenv/config.js'
import local from './local.js'
import fs from 'node:fs'
import './setup.js'
import zod from 'zod'
import path from 'node:path'
export { fs, local, path, zod }
`,
  )

  const result = biome('check', file, '--write')
  assert.equal(result.status, 0, result.diagnostics)
  const formatted = fs.readFileSync(file, 'utf8')
  const beforeSetup = formatted.split("import './setup.js'")[0]
  assert.ok(beforeSetup.startsWith("import 'dotenv/config.js'\n"))
  assert.ok(beforeSetup.includes("from 'node:fs'"))
  assert.ok(beforeSetup.includes("from './local.js'"))
  assert.ok(!beforeSetup.includes("from 'node:path'"))
  assert.ok(!beforeSetup.includes("from 'zod'"))
})

test('imports used only as types become explicit type imports', (t) => {
  const file = fixture(t, "import { Request } from 'express'\nexport type RouteRequest = Request\n")
  const result = biome('check', file, '--write')
  assert.equal(result.status, 0, result.diagnostics)
  assert.match(fs.readFileSync(file, 'utf8'), /import type \{ Request \} from 'express'/)
})

test('var, loose equality and unprefixed Node imports are errors', (t) => {
  const file = fixture(
    t,
    "import fs from 'fs'\nvar count = 1\nexport const equal = count == null\nexport { fs }\n",
  )
  const result = biome('lint', file)
  assert.equal(result.status, 1, result.diagnostics)
  for (const rule of ['noVar', 'noDoubleEquals', 'useNodejsImportProtocol']) {
    assert.ok(result.diagnostics.includes(rule), result.diagnostics)
  }
})

test('legacy any and floating promises remain visible warnings during migration', (t) => {
  const file = fixture(
    t,
    'export function legacy(value: any) { return value }\nasync function save(): Promise<void> {}\nsave()\n',
  )
  const result = biome('lint', file)
  assert.equal(result.status, 0, result.diagnostics)
  assert.ok(result.diagnostics.includes('noExplicitAny'), result.diagnostics)
  assert.ok(result.diagnostics.includes('noFloatingPromises'), result.diagnostics)
})

test('CI refuses unsorted imports without rewriting the file', (t) => {
  const source = "import path from 'node:path'\nimport fs from 'node:fs'\nexport { fs, path }\n"
  const file = fixture(t, source)
  const result = biome('ci', file)
  assert.equal(result.status, 1, result.diagnostics)
  assert.ok(result.diagnostics.includes('organizeImports'), result.diagnostics)
  assert.equal(fs.readFileSync(file, 'utf8'), source)
})

test('generated files are excluded even if they contain invalid syntax', (t) => {
  const file = fixture(t, '')
  const generatedDirectory = path.join(path.dirname(file), 'generated')
  fs.mkdirSync(generatedDirectory)
  const generatedFile = path.join(generatedDirectory, 'client.ts')
  fs.writeFileSync(generatedFile, 'this is not valid TypeScript !!!')
  const result = biome('check', generatedFile, '--no-errors-on-unmatched')
  assert.equal(result.status, 0, result.diagnostics)
  assert.ok(!result.diagnostics.includes('parse'), result.diagnostics)
})

test('a source directory named data is still checked', (t) => {
  const file = fixture(t, '')
  const sourceDirectory = path.join(path.dirname(file), 'src/routes/data')
  fs.mkdirSync(sourceDirectory, { recursive: true })
  const route = path.join(sourceDirectory, 'route.ts')
  fs.writeFileSync(route, 'this is not valid TypeScript !!!')
  const result = biome('check', route, '--no-errors-on-unmatched')
  assert.equal(result.status, 1, result.diagnostics)
  assert.ok(result.diagnostics.includes('parse'), result.diagnostics)
})
