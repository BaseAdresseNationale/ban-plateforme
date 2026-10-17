import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
export const migrationName = '0011_cache_diff_district_metadata';
export const migration = read(migrationName);
export const names = ['diff_common_toponym_ndjson', 'diff_address_ndjson'];
export function definitions(script) {
  return new Map([...script.matchAll(/CREATE OR REPLACE FUNCTION ban\.(\w+)\([\s\S]*?AS\s+(\$\w*\$)([\s\S]*?)\2\s*;/g)]
    .map(m => [m[1], { sql: m[0], body: m[3] }]));
}
const proposed = definitions(migration);
assert.deepEqual([...proposed.keys()], names);
export const newSql = [...proposed.values()].map(f => f.sql).join('\n');
const previous = definitions(read('0006_normalize_export_filter_arguments') + '\n' + read('0010_complete_export_metadata'));
export const oldSql = names.map(name => previous.get(name).sql).join('\n');
export const prerequisites = [...definitions(read('0005a_export_metadata_helpers')).values()].map(f => f.sql).join('\n')
  + '\n' + read('0007_optimize_address_diff_filters');
