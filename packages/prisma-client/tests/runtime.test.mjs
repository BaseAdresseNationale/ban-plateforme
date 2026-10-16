import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const directory = fileURLToPath(new URL('../', import.meta.url));

test('the ESM build imports and constructs the Prisma client in plain Node without connecting', () => {
  // Keep resolution inside the package; all generated test files stay in ignored dist/.
  fs.mkdirSync(path.join(directory, 'dist'), { recursive: true });
  const output = fs.mkdtempSync(path.join(directory, 'dist/runtime-test-'));
  const env = { ...process.env, NODE_OPTIONS: '', PG_URL: 'postgresql://127.0.0.1:1/ban_runtime_smoke?schema=ban' };
  try {
    // Code generation reads schema.prisma, not PostgreSQL; support a fresh checkout.
    const generate = spawnSync('pnpm', ['exec', 'prisma', 'generate', '--config', 'prisma.config.ts'],
      { cwd: directory, encoding: 'utf8', timeout: 60000, env });
    assert.equal(generate.status, 0, generate.stderr || generate.error?.message);
    const build = spawnSync('pnpm', ['exec', 'tsup', 'src/index.ts', '--format', 'esm', '--out-dir', output, '--silent'],
      { cwd: directory, encoding: 'utf8', timeout: 60000, env });
    assert.equal(build.status, 0, build.stderr || build.error?.message);
    const entry = pathToFileURL(path.join(output, 'index.js')).href;
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', `
      import assert from 'node:assert/strict';
      assert.equal(typeof globalThis.require, 'undefined');
      const { pool, getPrismaClient, PrismaClient, Prisma, exportNdjson } = await import(${JSON.stringify(entry)});
      try {
        assert.equal(pool.totalCount, 0);
        assert.equal(typeof PrismaClient, 'function');
        assert.equal(typeof Prisma.sql, 'function');
        assert.equal(typeof exportNdjson, 'function');
        const client = getPrismaClient();
        assert.equal(typeof client.address.findMany, 'function');
        assert.equal(typeof client.$queryRaw, 'function');
        await client.$disconnect();
        assert.equal(pool.totalCount, 0);
      } finally { await pool.end(); }
    `], { cwd: directory, encoding: 'utf8', timeout: 15000,
      env });
    assert.equal(run.status, 0, run.stderr || run.error?.message);
  } finally {
    // Only the freshly created, private test-build directory is disposable.
    fs.rmSync(output, { recursive: true });
  }
});
