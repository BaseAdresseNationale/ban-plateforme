import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import {definitions, migration, names} from './diff-metadata-helpers.mjs';

test('DIFF metadata cache is an atomic replacement of two invoker functions', () => {
  const functions = definitions(migration);
  assert.deepEqual([...functions.keys()], names);
  const statements = migration.replace(/--[^\n]*/g, '')
    .replace(/CREATE OR REPLACE FUNCTION ban\.\w+\([\s\S]*?AS\s+(\$\w*\$)[\s\S]*?\1\s*;/g, '').replace(/\s+/g, '');
  assert.equal(statements, 'BEGIN;COMMIT;');
  for (const {sql, body} of functions.values()) {
    assert.match(sql, /LANGUAGE sql STABLE SECURITY INVOKER/);
    assert.doesNotMatch(body, /\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|ALTER)\b/i);
    assert.equal([...body.matchAll(/AS MATERIALIZED/g)].length, 2);
    assert.match(body, /CASE WHEN ids IS NOT NULL THEN ban\.snapshot_district_cog/);
    for (const date of ['t_from', 't_to']) assert.ok(body.includes(`ban.snapshot_district(${date}, NULL, NULL)`));
  }
});

test('the three metadata prerequisite migrations already shared in Step 13 stay immutable', () => {
  const checksums = {
    '0000a_export_index_prerequisites': 'bb8d2dce326e399e056eadb174d9fb1d131df08acc6f02e5cb86888d792be251',
    '0005a_export_metadata_helpers': 'ab5dce983cd35270f93a1ee7b0743c06bee098860b54c4cf0f53a2ce01e2e7cd',
    '0010_complete_export_metadata': 'b56653b9d55b40f021ce69e187cd256dcb316e268591677e0a876eb4b4223af6',
  };
  for (const [name, hash] of Object.entries(checksums)) {
    const sql = fs.readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url));
    assert.equal(crypto.createHash('sha256').update(sql).digest('hex'), hash, name);
  }
});
