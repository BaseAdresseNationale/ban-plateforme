import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';

const read = name => fs.readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
const reference = JSON.parse(fs.readFileSync(new URL('./support/migration-export-reference.json', import.meta.url)));

test('the ten historical migrations retain their original SHA-256 checksums', () => {
  assert.equal(reference.historicalMigrations.length, 10);
  for (const migration of reference.historicalMigrations) {
    assert.equal(crypto.createHash('sha256').update(read(migration.name)).digest('hex'), migration.sha256, migration.name);
  }
});

test('preparation migrations sort before the first consumers without renaming history', () => {
  const names = fs.readdirSync(new URL('../prisma/migrations/', import.meta.url), { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort();
  assert.equal(names.length, 13);
  assert.equal(names.indexOf('0000a_export_index_prerequisites'), names.indexOf('0000_baseline') + 1);
  assert.equal(names.indexOf('0005a_export_metadata_helpers'), names.indexOf('0005_add_snapshot_functions_ndjson') + 1);
  assert.ok(names.indexOf('0005a_export_metadata_helpers') < names.indexOf('0006_normalize_export_filter_arguments'));
  assert.equal(names.at(-1), '0010_complete_export_metadata');
});

test('new index prerequisites provide UUID GiST support and the restored baseline index', () => {
  const sql = read('0000a_export_index_prerequisites');
  assert.match(sql, /BEGIN;[\s\S]*SET LOCAL search_path = ban, public;/);
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS address_h_range_validity_idx\s+ON ban.address_h USING gist \(range_validity\);/);
  assert.match(sql, /COMMIT;\s*$/);
});

test('new metadata preparation installs only the three helpers', () => {
  const sql = read('0005a_export_metadata_helpers');
  assert.equal([...sql.matchAll(/CREATE OR REPLACE FUNCTION/g)].length, 3);
  for (const name of ['export_line_meta', 'merge_export_line_meta', 'snapshot_district_cog']) {
    assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION ban\\.${name}\\(`));
  }
  assert.match(sql, /FROM ban.snapshot_district\(/);
});

test('final metadata migration is atomic and leaves all optimized functions untouched', () => {
  const sql = read('0010_complete_export_metadata');
  assert.match(sql, /\nBEGIN;/);
  assert.match(sql, /COMMIT;\s*$/);
  const functions = [...sql.matchAll(/CREATE OR REPLACE FUNCTION ban\.(\w+)\([\s\S]*?AS\s+(\$\w*\$)([\s\S]*?)\2;/g)];
  assert.deepEqual(functions.map(m => m[1]), ['snapshot_district_ndjson', 'diff_district_ndjson', 'diff_common_toponym_ndjson']);
  for (const fn of functions) {
    assert.match(fn[3], /'meta',\s*ban\.(export_line_meta|merge_export_line_meta)/);
  }
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ''), /\b(DROP|ALTER|INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
});
