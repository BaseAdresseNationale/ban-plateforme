import assert from 'node:assert/strict';

export const signatures = [
  'ban.snapshot_common_toponym(timestamptz,uuid[],uuid[],text[])',
  'ban.snapshot_common_toponym_ndjson(timestamptz,uuid[],uuid[],text[])',
  'ban.snapshot_address_ndjson(timestamptz,uuid[],uuid[],uuid[],text[])',
];

// Only the three function definitions are embedded in test transactions.
// Never embed the migration's BEGIN/COMMIT: it would commit test fixtures.
export function functionDefinitions(script) {
  const matches = [...script.matchAll(/CREATE OR REPLACE FUNCTION ban\.(\w+)\([\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)];
  assert.equal(matches.length, 3);
  const definitions = new Map(matches.map(match => [match[1], { sql: match[0], body: match[2] }]));
  assert.deepEqual([...definitions.keys()], signatures.map(signature => signature.split('(')[0].slice(4)));
  const remainder = script.replace(/--[^\n]*/g, '')
    .replace(/CREATE OR REPLACE FUNCTION ban\.\w+\([\s\S]*?AS \$\$[\s\S]*?\$\$;/g, '').replace(/\s+/g, '');
  assert.equal(remainder, 'BEGIN;COMMIT;', 'Unexpected statements outside atomic migration');
  return definitions;
}

export const normalizeSql = value => value.replace(/--[^\n]*/g, '').replace(/\s+/g, '');
export const literal = value => `'${String(value).replaceAll("'", "''")}'`;
export const uuidArray = values => values === null ? 'NULL::uuid[]' : `ARRAY[${values.map(literal).join(',')}]::uuid[]`;
export const textArray = values => values === null ? 'NULL::text[]' : `ARRAY[${values.map(literal).join(',')}]::text[]`;

export const catalogQuery = `SELECT json_build_object('db',current_database(),'role',current_user,
  'functions',(SELECT json_agg(json_build_object('signature',p.oid::regprocedure::text,
    'definition',pg_get_functiondef(p.oid),'source',p.prosrc,'owner',p.proowner,'acl',p.proacl,
    'args',p.proargnames,'securityDefiner',p.prosecdef,'volatility',p.provolatile) ORDER BY p.oid)
    FROM pg_proc p WHERE p.pronamespace='ban'::regnamespace),
  'indexes',(SELECT json_agg(row_to_json(i) ORDER BY indexname) FROM pg_indexes i WHERE schemaname='ban'),
  'constraints',(SELECT json_agg(json_build_object('name',conname,'definition',pg_get_constraintdef(oid),'valid',convalidated)
    ORDER BY oid) FROM pg_constraint WHERE connamespace='ban'::regnamespace),
  'triggers',(SELECT json_agg(json_build_object('table',tgrelid::regclass::text,'name',tgname,'enabled',tgenabled)
    ORDER BY oid) FROM pg_trigger WHERE tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='ban'::regnamespace)));`;
