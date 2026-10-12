import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const validator = fileURLToPath(new URL('./validate-ban-ndjson.mjs', import.meta.url));
function validate(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'ban-empty-validator-'));
  try {
    const file = path.join(dir,'stream.ndjson');
    fs.writeFileSync(file,lines.map(v=>JSON.stringify(v)).join('\n')+'\n');
    return spawnSync(process.execPath,[validator,file],{ encoding:'utf8' });
  } finally { fs.rmSync(dir,{ recursive:true,force:true }); }
}
for (const diff of [false,true]) test(`empty stream ban-standard/${diff ? 'diff':'full'}`, () => {
  const types = ['district','toponym','address'];
  const from = '2026-01-01T00:00:00.123456Z', to = '2026-01-01T00:00:00.123457Z';
  const start = { meta: {note:'stream-start', formatVersion:'0.4', format:'ban-standard', exportType:diff ? 'diff':'full',
    request:{dataTypes:types, departments:['96'], ...(diff ? {from,to} : {at:from})}}};
  // Reversed type and counter key order must not alter equality.
  const stats = Object.fromEntries([...types].reverse().map(t=>[t,diff ? {disabled:0,updated:0,created:0,count:0}:{count:0}]));
  const end = { meta:{note:'stream-end', generatedAt:to, stats}};
  assert.equal(validate([start,end]).status,0);
  delete stats[types[0]];
  assert.notEqual(validate([start,end]).status,0,'Selected zero-count types cannot be omitted');
  stats[types[0]] = diff ? {count:1,created:1,updated:0,disabled:0}:{count:1};
  assert.notEqual(validate([start,end]).status,0,'Non-zero declared count without content is invalid');
});

test('rejects an invalid format identifier', () => {
  const start = { meta: {note:'stream-start', formatVersion:'0.4', format:'unsupported', exportType:'full',
    request:{dataTypes:['address'], departments:['96'], at:'2026-01-01T00:00:00Z'}}};
  const end = { meta: {note:'stream-end', generatedAt:'2026-01-01T00:00:00Z', stats:{address:{count:0}}}};
  const result = validate([start,end]);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Only ban-standard is supported/);
});
