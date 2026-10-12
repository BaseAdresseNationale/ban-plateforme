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
for (const fr of [false,true]) for (const diff of [false,true]) test(`empty stream ${fr ? 'FR':'raw'}/${diff ? 'diff':'full'}`, () => {
  const types = fr ? ['commune','odonyme','adresse'] : ['district','toponym','address'];
  const from = '2026-01-01T00:00:00.123456Z', to = '2026-01-01T00:00:00.123457Z';
  const key = fr ? 'metadonnees' : 'meta';
  const start = { [key]: {note:'stream-start',[fr ? 'typeExport':'exportType']:diff ? 'diff':'ban',
    [fr ? 'requete':'request']:{[fr ? 'typesDonnees':'dataTypes']:types,
      ...(diff ? {[fr ? 'de':'from']:from,[fr ? 'a':'to']:to} : {[fr ? 'a':'at']:from})}}};
  // Reversed type and counter key order must not alter equality.
  const stats = Object.fromEntries([...types].reverse().map(t=>[t,diff ? {disabled:0,updated:0,created:0,count:0}:{count:0}]));
  const end = { [key]:{note:'stream-end',[fr ? 'statistiques':'stats']:stats}};
  assert.equal(validate([start,end]).status,0);
  delete stats[types[0]];
  assert.notEqual(validate([start,end]).status,0,'Selected zero-count types cannot be omitted');
  stats[types[0]] = diff ? {count:1,created:1,updated:0,disabled:0}:{count:1};
  assert.notEqual(validate([start,end]).status,0,'Non-zero declared count without content is invalid');
});
