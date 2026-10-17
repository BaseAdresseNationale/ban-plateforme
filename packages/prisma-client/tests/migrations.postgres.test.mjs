import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test, { before } from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { rows, syntheticIds } from './support/synthetic-fixture.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const migrationRoot = path.join(root, 'packages/prisma-client/prisma/migrations');
const config = path.join(root, 'packages/prisma-client/prisma.config.ts');
const reference = JSON.parse(fs.readFileSync(new URL('./support/migration-export-reference.json', import.meta.url)));
const migrations = fs.readdirSync(migrationRoot, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort();
const suffix = process.env.BAN_MIGRATION_TEST_SUFFIX ?? '';
assert.match(suffix, /^(?:[a-z0-9]{1,12})?$/, 'Suffixe de test invalide');
const targets = ['ban_migrations_additive_empty_tmp', 'ban_migrations_additive_restore_tmp', 'ban_migrations_additive_legacy_tmp', 'ban_migrations_additive_current_tmp']
  .map(name => name + (suffix ? `_${suffix}` : ''));
const enabled = process.env.RUN_BAN_MIGRATION_TESTS === '1';
const marker = 'BAN isolated migration test';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
let cluster, reportDirectory, operationSequence = 0;

function urlFor(database) {
  assert.ok(enabled && targets.includes(database), 'Opt-in et base de test autorisée requis');
  let url;
  try { url = new URL(process.env.PG_URL); } catch { throw Error('Fournir PG_URL en mémoire vers PostgreSQL local'); }
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'PostgreSQL doit être local');
  assert.equal(decodeURIComponent(url.username), 'ban_user', 'Rôle de test attendu : ban_user');
  assert.ok([...url.searchParams.keys()].every(k => k === 'schema') && url.searchParams.getAll('schema').length <= 1 && !url.hash,
    'Paramètres de connexion supplémentaires refusés');
  assert.ok(targets.includes(decodeURIComponent(url.pathname.slice(1))), 'PG_URL doit déjà désigner une des bases de test autorisées');
  url.pathname = `/${database}`;
  url.search = '?schema=ban';
  return url.toString();
}

async function connect(database) {
  const client = new pg.Client({ connectionString: urlFor(database), connectionTimeoutMillis: 10000,
    options: '-c statement_timeout=30000 -c lock_timeout=5000 -c timezone=UTC' });
  try {
    await client.connect();
    const { rows: [identity] } = await client.query(`SELECT current_database() AS db,current_user AS role,
      (SELECT system_identifier::text FROM pg_control_system()) AS cluster,
      (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) AS marker`);
    assert.equal(identity.db, database); assert.equal(identity.role, 'ban_user');
    assert.equal(identity.cluster, cluster, 'Autre instance PostgreSQL'); assert.equal(identity.marker, marker);
    return client;
  } catch {
    await client.end().catch(() => {});
    throw Error(`Connexion de test non validée : ${database} ; aucune migration lancée`);
  }
}

async function withClient(database, callback) {
  const client = await connect(database);
  try { return await callback(client); } finally { await client.end(); }
}

function prisma(database, action, name, configuration = config) {
  const file = path.join(reportDirectory, `${++operationSequence}-${database}-${action}${name ? `-${name}` : ''}.log`);
  const fd = fs.openSync(file, 'wx', 0o600);
  let result;
  try {
    result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', action, '--config', configuration, ...(name ? ['--applied', name] : [])],
      { cwd: root, env: { ...process.env, PG_URL: urlFor(database) }, stdio: ['ignore', fd, fd], timeout: 120000 });
  } finally { fs.closeSync(fd); }
  assert.ok(!result.error && result.status === 0, `Prisma ${action} en échec ; journal privé : ${file}`);
}

before(async () => {
  if (!enabled) return;
  // Identité du serveur lue par socket local, indépendamment de PG_URL.
  const local = spawnSync('docker', ['exec', '--env', 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=10000',
    'ban_postgres', 'psql', '--host=/var/run/postgresql', '--username=ban_user', '--dbname=postgres', '--no-psqlrc',
    '--set=ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--command', 'SELECT system_identifier FROM pg_control_system();'],
  { encoding: 'utf8', timeout: 15000 });
  assert.ok(!local.error && local.status === 0, 'Serveur Docker local indisponible');
  cluster = local.stdout.trim(); assert.match(cluster, /^\d+$/);
  // Toutes les cibles doivent être neuves avant toute écriture sur l’une d’elles.
  for (const database of targets) await withClient(database, async client => {
    const { rows: [state] } = await client.query(`SELECT count(*)::int AS objects FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'`);
    assert.equal(state.objects, 0, `${database} doit être neuve ; aucun nettoyage automatique`);
  });
  const base = path.join(root, 'working/prisma-migration-tests');
  fs.mkdirSync(base, { recursive: true, mode: 0o700 });
  reportDirectory = fs.mkdtempSync(path.join(base, 'run-')); fs.chmodSync(reportDirectory, 0o700);
});

const selectors = {
  district: "NULL::uuid[],ARRAY['96']::text[]",
  common_toponym: "NULL::uuid[],NULL::uuid[],ARRAY['96']::text[]",
  address: "NULL::uuid[],NULL::uuid[],NULL::uuid[],ARRAY['96']::text[]",
};

async function ndjson(client, mode, type, selection = selectors[type]) {
  const dates = mode === 'snapshot' ? "'2026-04-01T00:00:00Z'::timestamptz" : "'2026-01-15T00:00:00Z'::timestamptz,'2026-04-01T00:00:00Z'::timestamptz";
  const { rows: output } = await client.query(`SELECT line FROM ban.${mode}_${type}_ndjson(${dates},${selection}) AS t(line)`);
  return output.map(r => JSON.parse(r.line));
}

async function verifyInstallation(client) {
  const { rows: installed } = await client.query(`SELECT p.proname AS name,p.oid::regprocedure::text AS signature,
    p.prosrc AS body,p.prosecdef AS definer,pg_get_userbyid(p.proowner) AS owner
    FROM pg_proc p WHERE p.pronamespace='ban'::regnamespace AND p.prokind='f' ORDER BY p.proname`);
  assert.equal(installed.length, 17);
  for (const expected of reference.functions) {
    const actual = installed.find(f => f.signature === expected.signature);
    assert.ok(actual, expected.signature); assert.equal(hash(actual.body.trim()), expected.bodySha256, expected.name);
    assert.equal(actual.definer, false); assert.equal(actual.owner, 'ban_user');
  }
  const { rows: indexes } = await client.query(`SELECT i.relname AS name,pg_get_indexdef(i.oid) AS definition,x.indisvalid AS valid,x.indisready AS ready
    FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class t ON t.oid=x.indrelid WHERE t.relnamespace='ban'::regnamespace`);
  for (const expected of reference.indexes) {
    const actual = indexes.find(i => i.name === expected.name);
    assert.ok(actual?.valid && actual.ready, expected.name); assert.equal(actual.definition, expected.definition);
  }
  const { rows: registry } = await client.query(`SELECT migration_name AS name,checksum,finished_at,rolled_back_at FROM ban._prisma_migrations ORDER BY migration_name COLLATE "C"`);
  assert.deepEqual(registry.map(r => r.name), migrations);
  for (const row of registry) {
    assert.equal(row.checksum, hash(fs.readFileSync(path.join(migrationRoot, row.name, 'migration.sql'))));
    assert.ok(row.finished_at && !row.rolled_back_at);
  }
  return { functions: installed.map(f => ({ signature: f.signature, bodySha256: hash(f.body.trim()) })),
    indexes: reference.indexes.map(i => i.name), migrations: registry.map(r => ({ name: r.name, checksum: r.checksum })) };
}

async function seedFixture(client) {
  // Neuf lignes synthétiques, dans les bases de test uniquement ; aucune donnée du dump.
  await client.query('BEGIN');
  try {
    for (const [table, records] of Object.entries(rows)) {
      await client.query(`INSERT INTO ban.${table} SELECT * FROM jsonb_populate_recordset(NULL::ban.${table},$1::jsonb)`, [JSON.stringify(records)]);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

async function qualifyExports(client, seeded = false) {
  if (!seeded) {
    for (const mode of ['snapshot', 'diff']) for (const type of Object.keys(selectors)) {
      assert.deepEqual(await ndjson(client, mode, type), [], `${mode}/${type} vide`);
    }
    await seedFixture(client);
  }
  for (const [type, count] of [['district', 1], ['common_toponym', 2], ['address', 3]]) {
    const lines = await ndjson(client, 'snapshot', type);
    assert.equal(lines.length, count, `snapshot/${type}`);
    for (const line of lines) assert.equal(line.meta.insee.cog, '96001');
  }
  const changes = await ndjson(client, 'diff', 'address');
  assert.deepEqual(changes.map(r => r.event).sort(), ['created', 'disabled', 'updated']);
  for (const line of changes) assert.equal(line.meta.insee.cog, '96001');
  // Les deux autres enveloppes DIFF doivent aussi publier les métadonnées.
  for (const type of ['district', 'common_toponym']) {
    const dates = "'2025-12-31T00:00:00Z'::timestamptz,'2026-04-01T00:00:00Z'::timestamptz";
    const { rows: output } = await client.query(`SELECT line FROM ban.diff_${type}_ndjson(${dates},${selectors[type]}) AS t(line)`);
    assert.equal(output.length, type === 'district' ? 1 : 2);
    for (const { line } of output) assert.equal(JSON.parse(line).meta.insee.cog, '96001');
  }
  const selected = await ndjson(client, 'diff', 'address',
    `NULL::uuid[],ARRAY['${syntheticIds.toponym}']::uuid[],ARRAY['${syntheticIds.district}']::uuid[],ARRAY['96']::text[]`);
  assert.deepEqual(selected, changes);
  for (const mode of ['snapshot', 'diff']) for (const type of Object.keys(selectors)) {
    assert.deepEqual(await ndjson(client, mode, type, selectors[type].replace("'96'", "'99'")), [], `${mode}/${type} département absent`);
  }
}

async function legacyState(client) {
  const { rows: registry } = await client.query('SELECT * FROM ban._prisma_migrations ORDER BY migration_name COLLATE "C"');
  const { rows: functions } = await client.query("SELECT proname,prosrc FROM pg_proc WHERE pronamespace='ban'::regnamespace AND prokind='f' ORDER BY proname");
  const data = {};
  for (const table of Object.keys(rows)) {
    const result = await client.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') AS data FROM ban.${table} t`);
    data[table] = hash(JSON.stringify(result.rows[0].data));
  }
  return { registry, functions: functions.map(f => ({ name: f.proname, sha256: hash(f.prosrc.trim()) })), data };
}

async function installHistoricalChain(database) {
  // Reconstitue un historique réellement exécuté par Prisma, sans INSERT ni UPDATE du registre.
  const directory = path.join(reportDirectory, 'historical');
  fs.mkdirSync(path.join(directory, 'migrations'), { recursive: true });
  const configuration = path.join(directory, 'prisma.config.ts');
  fs.writeFileSync(configuration, `import {defineConfig,env} from 'prisma/config';\nexport default defineConfig({schema:${JSON.stringify(path.join(root, 'packages/prisma-client/prisma/schema.prisma'))},migrations:{path:'./migrations'},datasource:{url:env('PG_URL')}});\n`, { mode: 0o600 });
  const copy = migration => {
    fs.mkdirSync(path.join(directory, 'migrations', migration.name));
    fs.copyFileSync(path.join(migrationRoot, migration.name, 'migration.sql'), path.join(directory, 'migrations', migration.name, 'migration.sql'));
  };
  await withClient(database, client => client.query('CREATE EXTENSION btree_gist WITH SCHEMA public'));
  for (const migration of reference.historicalMigrations.slice(0, 6)) copy(migration);
  prisma(database, 'deploy', undefined, configuration);
  // Les anciennes installations avaient reçu ces auxiliaires hors migrations.
  // La fixture SQL préexistante fournit les définitions, indépendamment des nouveaux fichiers.
  const support = fs.readFileSync(new URL('./support/export-schema.sql', import.meta.url), 'utf8');
  const definitions = new Map([...support.matchAll(/CREATE OR REPLACE FUNCTION ban\.(\w+)\([\s\S]*?\bAS\s+(\$\w*\$)[\s\S]*?\2\s*;/g)]
    .map(match => [match[1], match[0]]));
  const helpers = ['export_line_meta', 'merge_export_line_meta', 'snapshot_district_cog'].map(name => {
    const definition = definitions.get(name);
    assert.ok(definition, name); return definition;
  }).join('\n');
  await withClient(database, client => client.query(helpers));
  for (const migration of reference.historicalMigrations.slice(6)) copy(migration);
  prisma(database, 'deploy', undefined, configuration);
  return withClient(database, async client => {
    await seedFixture(client);
    const state = await legacyState(client);
    assert.equal(state.registry.length, 10);
    for (const migration of reference.historicalMigrations) {
      const entry = state.registry.find(r => r.migration_name === migration.name);
      assert.equal(entry?.checksum, migration.sha256); assert.ok(entry.finished_at && !entry.rolled_back_at);
    }
    return state;
  });
}

const scenarios = [
  'Prisma deploy from empty: fourteen migrations, canonical exports and indexes',
  'Prisma baseline + deploy on existing schema: preserve data and custom objects',
  'Prisma deploy after ten historical migrations: apply interleaved additions without changing old registry rows or optimized functions',
  'Prisma deploy after thirteen installed migrations: add only the DIFF cache and preserve the existing registry and data',
];
for (const [index, database] of targets.entries()) test(scenarios[index], { skip: !enabled }, async () => {
  const startedAt = new Date().toISOString();
  let historical;
  if (index === 1) {
    const baseline = fs.readFileSync(path.join(migrationRoot, '0000_baseline/migration.sql'), 'utf8');
    await withClient(database, async client => {
      await client.query(`BEGIN; SET LOCAL search_path=ban,public; ${baseline}
        DROP INDEX ban.address_h_range_validity_idx;
        INSERT INTO ban.district VALUES ('22222222-2222-4222-8222-222222222222',ARRAY[]::jsonb[],now(),'{}','{"insee":{"cog":"98001"}}',tstzrange(now(),NULL),true);
        CREATE TABLE public.migration_test_sentinel (id integer PRIMARY KEY);
        INSERT INTO public.migration_test_sentinel VALUES (42);
        CREATE FUNCTION public.migration_test_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
        CREATE TRIGGER migration_test_guard BEFORE UPDATE ON public.migration_test_sentinel FOR EACH ROW EXECUTE FUNCTION public.migration_test_trigger();
        COMMIT;`);
    });
    prisma(database, 'resolve', '0000_baseline');
  }
  if (index === 2) historical = await installHistoricalChain(database);
  if (index === 3) {
    const directory = path.join(reportDirectory, 'before-diff-cache');
    fs.mkdirSync(path.join(directory, 'migrations'), {recursive: true});
    const configuration = path.join(directory, 'prisma.config.ts');
    fs.writeFileSync(configuration, `import {defineConfig,env} from 'prisma/config';\nexport default defineConfig({schema:${JSON.stringify(path.join(root, 'packages/prisma-client/prisma/schema.prisma'))},migrations:{path:'./migrations'},datasource:{url:env('PG_URL')}});\n`, {mode: 0o600});
    for (const name of migrations.slice(0, -1)) {
      fs.mkdirSync(path.join(directory, 'migrations', name));
      fs.copyFileSync(path.join(migrationRoot, name, 'migration.sql'), path.join(directory, 'migrations', name, 'migration.sql'));
    }
    prisma(database, 'deploy', undefined, configuration);
    historical = await withClient(database, async client => {
      await seedFixture(client);return legacyState(client);
    });
    assert.equal(historical.registry.length, 13);
  }
  prisma(database, 'deploy');
  const evidence = await withClient(database, async client => {
    const installed = await verifyInstallation(client);
    await qualifyExports(client, index >= 2);
    if (index === 1) {
      assert.equal((await client.query('SELECT id FROM public.migration_test_sentinel')).rows[0].id, 42);
      assert.equal((await client.query("SELECT tgenabled FROM pg_trigger WHERE tgname='migration_test_guard'")).rows[0].tgenabled, 'O');
      assert.equal((await client.query("SELECT count(*)::int AS n FROM ban.district WHERE id='22222222-2222-4222-8222-222222222222'")).rows[0].n, 1);
    }
    if (historical) {
      const after = await legacyState(client);
      assert.deepEqual(after.registry.filter(r => historical.registry.some(m => m.migration_name === r.migration_name)), historical.registry);
      assert.deepEqual(after.data, historical.data);
      const changedWrappers = index === 3 ? ['diff_common_toponym_ndjson', 'diff_address_ndjson']
        : ['snapshot_district_ndjson', 'diff_district_ndjson', 'diff_common_toponym_ndjson', 'diff_address_ndjson'];
      assert.deepEqual(after.functions.filter(f => !changedWrappers.includes(f.name)), historical.functions.filter(f => !changedWrappers.includes(f.name)));
    }
    return installed;
  });
  // Une deuxième commande deploy ne doit modifier aucune définition ni empreinte.
  const again = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy', '--config', config],
    { cwd: root, env: { ...process.env, PG_URL: urlFor(database) }, encoding: 'utf8', timeout: 120000 });
  assert.ok(!again.error && again.status === 0, 'Deuxième deploy en échec');
  assert.deepEqual(await withClient(database, verifyInstallation), evidence);
  fs.writeFileSync(path.join(reportDirectory, `${database}.json`), JSON.stringify({ database, startedAt,
    finishedAt: new Date().toISOString(), status: 'success', ...(historical ? { historicalRegistryPreserved: true,
      historicalDataPreserved: true, optimizedFunctionsPreserved: true } : {}), ...evidence }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
});
