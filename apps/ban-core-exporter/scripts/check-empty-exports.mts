// Real application exports on small test databases; every SQL session is read-only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const [target, output] = process.argv.slice(2);
if (process.env.RUN_BAN_POSTGRES_TESTS !== '1' || !['ban_export_validation_tmp','ban_fixture_validation_tmp'].includes(target)) {
  throw new Error('Opt-in and an authorized small test database required');
}
if (!output || fs.existsSync(output)) throw new Error('A new output directory is required');
const env = dotenv.parse(fs.readFileSync(path.join(root,'.env')));
const url = new URL(env.PG_URL);
if (!['localhost','127.0.0.1','[::1]'].includes(url.hostname) || decodeURIComponent(url.username) !== 'ban_user') throw new Error('Local ban_user connection required');
url.pathname = '/' + target;
url.searchParams.set('options','-c default_transaction_read_only=on -c statement_timeout=30000 -c timezone=UTC');
dotenv.populate(process.env,env);
process.env.PG_URL = url.toString();
process.env.PG_DB = target;
process.env.EXPORT_OUTPUT_DIR = path.resolve(output);
const {pool} = await import('@ban/prisma-client');
const {generateLocalExportFile} = await import('../src/export/generate.ts');
const {getExportFileName} = await import('../src/export/file-naming.ts');
const {fullRequestConfigs} = await import('../src/export/full/full-config.ts');
const {diffRequestConfigs} = await import('../src/export/diff/diff-config.ts');
const requireExporter = createRequire(path.join(root,'apps/ban-core-exporter/package.json'));
const {Ajv2020} = requireExporter('ajv/dist/2020.js');
const spec = path.join(root,'apps/ban-core-exporter/specifications/ban-diff/v0.4');
const results: any[] = [];
let token = 0;
const base = { dataTypes:['district','toponym','address'], departements:['96'],
  address_ids:null, common_toponym_ids:null, district_ids:null };
async function check(name: string, task: () => Promise<any>) {
  try { results.push({name,ok:true,...await task()}); }
  catch (e: any) { results.push({name,ok:false,error:e.message}); }
  console.log(JSON.stringify(results.at(-1)));
}
try {
  const identity = (await pool.query(`SELECT current_database() db,current_setting('default_transaction_read_only') readonly,
    (SELECT count(*) FROM ban.address) addresses`)).rows[0];
  assert.equal(identity.db,target); assert.equal(identity.readonly,'on');
  assert.equal(Number(identity.addresses),target === 'ban_fixture_validation_tmp' ? 0 : 4);
  fs.mkdirSync(output,{mode:0o700});
  const scenarios = target === 'ban_fixture_validation_tmp' ? [['empty database',{}]] : [
    ['missing department',{departements:['99']}],
    ['missing UUID',{dataTypes:['address'],address_ids:['11111111-1111-4111-8111-000000000099']}],
    ['stable period',{}], ['before creation',{before:true}],
  ];
  for (const [name, extra] of scenarios as [string,any][]) for (const type of ['full','diff'] as const) {
    if (name === 'stable period' && type === 'full') continue;
    await check(`${name}/${type}`,async () => {
      const {before,...selection} = extra;
      const from = before ? '2025-10-01T00:00:00.123456Z':'2026-04-01T00:00:00.123456Z';
      const to = before ? '2025-10-02T00:00:00.123457Z':'2026-04-02T00:00:00.123457Z';
      const result = await generateLocalExportFile(`empty-${++token}`,type,{...base,...selection,
        ...(type === 'full' ? {at:to}:{from,to})});
      const lines = fs.readFileSync(result.filePath,'utf8').trim().split('\n').map(line=>JSON.parse(line));
      assert.equal(lines.length,2); assert.equal(result.stats.count,0);
      const ajv = new Ajv2020({ strict:false, formats: {
        'date-time':(v:string)=>Number.isFinite(Date.parse(v)),
        uuid:(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
      }});
      const read = (suffix:string)=>JSON.parse(fs.readFileSync(path.join(spec,'schemas',`ban-standard-${suffix}-v0.4.schema.json`),'utf8'));
      ajv.addSchema(read('definitions'));
      const validate = ajv.compile(read(type));
      for (const row of lines) assert.ok(validate(row),ajv.errorsText(validate.errors));
      const semantic = spawnSync(process.execPath,[path.join(spec,'scripts/validate-ban-ndjson.mjs'),result.filePath],{encoding:'utf8'});
      assert.equal(semantic.status,0,semantic.stderr);
      return {count:0,schema:'v0.4',semantic:'validated',file:path.basename(result.filePath)};
    });
  }
  // In-memory query substitution provokes a genuine PostgreSQL missing-function
  // error without dropping/renaming any database object. Restore config in finally.
  for (const type of ['full','diff'] as const) await check(`missing function/${type}`,async () => {
    const config = (type === 'full' ? fullRequestConfigs:diffRequestConfigs).district;
    const original = config.request;
    config.request = 'SELECT ban.__missing_export_function_for_test()';
    const failedToken = `missing-${++token}`;
    const params = {...base,dataTypes:['district'],
      ...(type === 'full' ? {at:'2026-04-01T00:00:00Z'}:{from:'2026-04-01T00:00:00Z',to:'2026-04-02T00:00:00Z'})};
    try {
      await assert.rejects(generateLocalExportFile(failedToken,type,params),
        (error:any)=>error.code === '42883');
      const file = path.join(output,getExportFileName(failedToken,type,params));
      assert.ok(fs.existsSync(file), 'Missing partial file diagnostic');
      assert.ok(!fs.readFileSync(file,'utf8').includes('stream-end'));
      return {error:'42883',success:false,simulation:'query only; database structure untouched'};
    } finally { config.request = original; }
  });
} finally {
  await pool.end();
  if (fs.existsSync(output)) fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({target,readonly:true,results},null,2)+'\n',{flag:'wx'});
}
if (results.some(r=>!r.ok)) process.exitCode = 1;
