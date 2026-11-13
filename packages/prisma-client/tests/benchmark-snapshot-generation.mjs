// Candidate-only READ ONLY diagnostic. Execute SELECT bodies, never install 0009.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { functionDefinitions, normalizeSql, uuidArray, literal, catalogQuery } from './snapshot-generation-helpers.mjs';

const [output] = process.argv.slice(2);
if (process.env.RUN_BAN_POSTGRES_TESTS !== '1' || !output || fs.existsSync(output)) {
  throw new Error('Opt-in and a new report path are required');
}
const target = 'ban_restore_validation';
const at = '2026-06-01T00:00:00+02:00';
const definitions = file => functionDefinitions(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
const proposed = definitions('../prisma/migrations/0009_optimize_snapshot_generation/migration.sql');
const reference = definitions('./support/rollback-snapshot-generation.sql');
const addressReference = fs.readFileSync(new URL('../prisma/migrations/0008_optimize_address_snapshot_filters/migration.sql', import.meta.url), 'utf8')
  .match(/AS \$\$([\s\S]*?)\$\$/)[1];
function read(query) {
  const result = spawnSync('docker', ['exec', '-i', 'ban_postgres', 'psql', '--username=ban_user',
    `--dbname=${target}`, '--no-psqlrc', '--set=ON_ERROR_STOP=1', '--quiet', '--tuples-only', '--no-align', '--file=-'], {
    input: `BEGIN READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL statement_timeout='30s';
      DO $$ BEGIN IF current_database()<>'${target}' THEN RAISE EXCEPTION 'Wrong candidate'; END IF; END $$;
      ${query}\nROLLBACK;`, encoding: 'utf8', timeout: 45000, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.error?.message || 'Candidate query failed');
  return JSON.parse(result.stdout.trim());
}
const migrationsQuery = `SELECT json_agg(json_build_object('name',migration_name,'checksum',checksum,
  'finished',finished_at IS NOT NULL,'rolledBack',rolled_back_at IS NOT NULL) ORDER BY migration_name)
  FROM ban._prisma_migrations;`;
const inspect = () => ({ catalog: read(catalogQuery), migrations: read(migrationsQuery) });
const parameters = selection => ({ as_of: `${literal(at)}::timestamptz`, ids: uuidArray(selection),
  common_toponym_ids: 'NULL::uuid[]', district_ids: 'NULL::uuid[]', departements: "ARRAY['31']::text[]" });
const inline = (body, params) => body.replace(/--[^\n]*/g, '')
  .replace(/\b(as_of|ids|common_toponym_ids|district_ids|departements)\b/g, key => `(${params[key]})`).trim().replace(/;$/, '');
const plan = query => read(`EXPLAIN (FORMAT JSON) ${query};`)[0];
const executePlan = query => read(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query};`)[0];
const rows = query => read(`SELECT COALESCE(json_agg(r.line ORDER BY r.line),'[]'::json) FROM (${query}) r(line);`);
const planNodes = node => [node, ...(node.Plans ?? []).flatMap(planNodes)];
const report = { target, at, readonly: true, installed: false, startedAt: new Date().toISOString(),
  sampleLimit: 200, results: [], fullExportStillRequired: true, cachesAndLoadControlled: false };
let before;
try {
  before = inspect();
  assert.equal(before.catalog.db, target); assert.equal(before.catalog.role, 'ban_user');
  assert.equal(before.catalog.functions.length, 17); assert.equal(before.migrations.length, 9);
  assert.ok(before.migrations.every(migration => migration.finished && !migration.rolledBack));
  assert.ok(!before.migrations.some(migration => migration.name.startsWith('0009')));
  for (const [name, definition] of reference) {
    const installed = before.catalog.functions.find(fn => fn.signature.startsWith(`ban.${name}(`));
    assert.ok(installed, name); assert.equal(normalizeSql(installed.source), normalizeSql(definition.body), name);
  }
  assert.equal(normalizeSql(before.catalog.functions.find(fn => fn.signature.startsWith('ban.snapshot_address(')).source), normalizeSql(addressReference));
  // Plan both full departmental requests, but do not execute the old nationwide sort.
  report.fullPlans = {};
  for (const name of ['snapshot_common_toponym', 'snapshot_address_ndjson']) {
    report.fullPlans[name] = { original: plan(inline(reference.get(name).body, parameters(null))),
      proposed: plan(inline(proposed.get(name).body, parameters(null))) };
  }
  for (const [table, wrapper] of [['common_toponym', 'snapshot_common_toponym_ndjson'], ['address', 'snapshot_address_ndjson']]) {
    // Obtain a bounded ID sample without running an unbounded snapshot or sorting JSON.
    const selectedIds = read(`WITH district_ids AS MATERIALIZED (
      SELECT id FROM ban._snapshot_district_ids(${literal(at)}::timestamptz,ARRAY['31']::text[])
    ) SELECT COALESCE(json_agg(id ORDER BY id),'[]'::json) FROM (
      SELECT DISTINCT id FROM (
        (SELECT id FROM ban.${table} WHERE range_validity @> ${literal(at)}::timestamptz
          AND ("isActive" IS DISTINCT FROM false) AND "districtID"=ANY(ARRAY(SELECT id FROM district_ids)) LIMIT 200)
        UNION ALL
        (SELECT id FROM ban.${table}_h WHERE range_validity @> ${literal(at)}::timestamptz
          AND ("isActive" IS DISTINCT FROM false) AND "districtID"=ANY(ARRAY(SELECT id FROM district_ids)) LIMIT 200)
      ) sample LIMIT 200
    ) picked;`);
    assert.ok(selectedIds.length > 0 && selectedIds.length <= 200);
    for (const mode of ['departmentalCacheProbe', 'explicitUuidRequest']) {
      // The cache probe has ids=NULL in the wrapper but bounds its source to the
      // sampled IDs. It measures metadata caching, not an entire departmental job.
      const params = parameters(mode === 'explicitUuidRequest' ? selectedIds : null);
      const sourceParams = parameters(selectedIds);
      const sourceArguments = [sourceParams.as_of, sourceParams.ids,
        ...(table === 'address' ? [sourceParams.common_toponym_ids] : []),
        sourceParams.district_ids, sourceParams.departements].join(',');
      const oldSource = `ban.snapshot_${table}(${sourceArguments})`;
      const newSource = table === 'common_toponym'
        ? `(${inline(proposed.get('snapshot_common_toponym').body, sourceParams)})` : oldSource;
      const sourceCall = new RegExp(`ban\\.snapshot_${table}\\(as_of, ids, ${table === 'address' ? 'common_toponym_ids, ' : ''}district_ids, departements\\) t`);
      const render = (definition, source) => {
        assert.ok(sourceCall.test(definition.body));
        return inline(definition.body.replace(sourceCall, `${source} t(type,nodekey,data)`), params);
      };
      const oldQuery = render(reference.get(wrapper), oldSource);
      const newQuery = render(proposed.get(wrapper), newSource);
      report.pendingCase = { table, mode };
      const oldRows = rows(oldQuery), newRows = rows(newQuery);
      assert.deepEqual(newRows, oldRows);
      assert.ok(newRows.length > 0);
      const oldExecution = executePlan(oldQuery), newExecution = executePlan(newQuery);
      const cachePlan = planNodes(newExecution.Plan).find(node => node['Subplan Name'] === 'CTE district_cogs');
      assert.ok(cachePlan, 'Commune cache CTE not found in the execution plan');
      assert.equal(cachePlan['Actual Loops'], 1);
      if (mode === 'explicitUuidRequest') assert.equal(cachePlan['Actual Rows'], 0);
      else assert.ok(cachePlan['Actual Rows'] > 0);
      report.results.push({ table, mode, count: newRows.length, exactComparison: true,
        originalExecutionMs: oldExecution['Execution Time'], proposedExecutionMs: newExecution['Execution Time'],
        communeCacheRows: cachePlan['Actual Rows'], communeCacheLoops: cachePlan['Actual Loops'],
        originalPlan: oldExecution.Plan, proposedPlan: newExecution.Plan });
      delete report.pendingCase;
      console.log(JSON.stringify({ table, mode, count: newRows.length,
        originalMs: oldExecution['Execution Time'], proposedMs: newExecution['Execution Time'] }));
    }
  }
  // Execute only the proposed departmental toponym SELECT, with a 30-second cap.
  // No wrapper installation and no address full export are attempted here.
  report.pendingCase = { table: 'common_toponym', mode: 'departmentalSelection' };
  const execution = executePlan(inline(proposed.get('snapshot_common_toponym').body, parameters(null)));
  report.departmentalToponyms = { count: execution.Plan['Actual Rows'], executionMs: execution['Execution Time'], plan: execution.Plan };
  delete report.pendingCase;
  report.status = 'success';
} catch (error) {
  report.status = 'error'; report.error = error.message; process.exitCode = 1; console.error(error.message);
} finally {
  let after;
  if (before) {
    try {
      after = inspect();
      report.candidateCatalogAndMigrationsUnchanged = JSON.stringify(after) === JSON.stringify(before);
      if (!report.candidateCatalogAndMigrationsUnchanged) {
        report.status = 'error'; report.error = 'Candidate catalog or migration registry changed during diagnostic';
        process.exitCode = 1;
      }
    } catch (error) {
      report.status = 'error'; report.error = `Final catalog check failed: ${error.message}`;
      process.exitCode = 1;
    }
  }
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.resolve(output), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  if (after) assert.deepEqual(after, before, 'Candidate catalog or migration registry changed during diagnostic');
}
