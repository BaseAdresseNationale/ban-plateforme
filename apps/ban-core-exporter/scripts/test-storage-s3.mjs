import { createRequire } from 'node:module';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Keep the opt-in environment portable across Windows, Linux and macOS.
const require = createRequire(import.meta.url);
const vitest = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
const result = spawnSync(process.execPath, [vitest, 'run', 'src/export/storage.test.ts', '--testNamePattern', 'local S3 streaming'], {
  cwd: new URL('../', import.meta.url), env: { ...process.env, RUN_S3_STORAGE_TESTS: '1' }, stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
