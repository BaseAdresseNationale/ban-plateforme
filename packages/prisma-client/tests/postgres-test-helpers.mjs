import { spawnSync } from 'node:child_process';

const targets = ['ban_export_validation_tmp', 'ban_fixture_validation_tmp'];
export function sql(database, query, { readonly = false, variables = {}, failure = false } = {}) {
  if (!targets.includes(database) || process.env.RUN_BAN_POSTGRES_TESTS !== '1') {
    throw new Error('Tests PostgreSQL isolés : RUN_BAN_POSTGRES_TESTS=1 et cible autorisée requis');
  }
  const guard = `DO $$ BEGIN IF current_database() <> '${database}' THEN RAISE EXCEPTION 'Wrong test target'; END IF; END $$;\n`;
  const args = ['exec', '-i', 'ban_postgres', 'psql', '--username=ban_user', `--dbname=${database}`,
    '--no-psqlrc', '--set=ON_ERROR_STOP=1', '--quiet', '--tuples-only', '--no-align', '--file=-'];
  for (const [key, value] of Object.entries(variables)) {
    if (!/^[A-Z_]+$/.test(key)) throw new Error('Unexpected psql variable');
    args.push(`--set=${key}=${value}`);
  }
  const input = readonly ? `BEGIN READ ONLY; SET LOCAL timezone='UTC'; SET LOCAL statement_timeout='30s'; ${guard}${query}\nROLLBACK;`
    : `SET timezone='UTC'; SET statement_timeout='30s'; ${guard}${query}`;
  const result = spawnSync('docker', args, { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 60000 });
  if (result.error || (!failure && result.status !== 0)) throw new Error(result.stderr || result.error?.message || 'SQL test failed');
  return result;
}
export function jsonLines(result) {
  return result.stdout.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}
