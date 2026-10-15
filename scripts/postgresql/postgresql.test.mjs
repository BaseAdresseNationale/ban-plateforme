import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { estimateSpace, parseArgs, parseDf, run } from './postgresql.mjs';

const toc = '; Format: CUSTOM\n; Dumped from database version: 17.7\n1; 0 0 EXTENSION - postgis\n2; 0 0 EXTENSION - btree_gist';
const tables = ['address', 'address_h', 'common_toponym', 'common_toponym_h', 'district', 'district_h', 'district_config', 'district_config_h'];
function fixture(t, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ban-pg-tools-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const reportDirectory = path.join(root, 'reports');
  const calls = [], output = [];
  const inventory = { database: 'ban_restore', tables: tables.map(relname => ({ schemaname: 'ban', relname })),
    indexes: [], constraints: [], triggers: [], functions: [], extensions: [{ extname: 'postgis' }, { extname: 'btree_gist' }] };
  const docker = async (args, configuration) => {
    if (args[0] === 'exec') {
      const containerIndex = args.indexOf('synthetic-container-id');
      assert.ok(containerIndex > 0, 'Conteneur inspecté utilisé');
      assert.ok(['psql', 'pg_restore', 'pg_dump', 'df', 'stat', 'readlink', 'test', 'sh', 'sha256sum'].includes(args[containerIndex + 1]),
        'La commande doit suivre le conteneur ; les options Docker --env doivent le précéder');
      for (const [index, arg] of args.entries()) if (arg.startsWith('PGOPTIONS=')) assert.ok(index < containerIndex);
    }
    calls.push({ args, configuration });
    const sql = args.find(a => a.startsWith('--command=')) ?? '';
    if (args[0] === 'inspect') return JSON.stringify([{ Id: 'synthetic-container-id', State: { Running: true },
      HostConfig: { Memory: 4e9 }, Mounts: overrides.mounts ?? [{ Type: 'volume', Source: '/vm/backups', Destination: '/backups', RW: true }] }]);
    if (args[0] === 'info') return JSON.stringify({ MemTotal: 8e9 });
    if (args[0] === 'stats') return JSON.stringify({ MemUsage: '100 MiB / 4 GiB' });
    if (args.includes('--version')) return `${args.includes('pg_dump') ? 'pg_dump' : 'pg_restore'} (PostgreSQL) ${overrides.clientVersion ?? '17.7'}`;
    if (args.includes('df')) {
      const wal = args.at(-1).endsWith('pg_wal');
      const device = overrides.separateWal && wal ? '/dev/wal' : '/dev/data';
      const free = overrides.freeKb ?? 100_000_000;
      return `Filesystem 1024-blocks Used Available Capacity Mounted on\n${device} 200000000 100 ${free} 1% /var/lib/postgresql/data`;
    }
    if (args.includes('readlink')) return args.at(-1).endsWith('pg_wal') ? '/var/lib/postgresql/data/pg_wal' : (overrides.archiveParent ?? '/backups');
    if (args.includes('test')) return '';
    if (args.includes('stat')) return overrides.changedArchive && calls.filter(c => c.args.includes('stat')).length > 1 ? 'changed' : '1:2:1234:5678:5678';
    if (args.includes('sha256sum')) return `${overrides.hash ?? 'a'.repeat(64)}  /backups/archive.dump`;
    if (args.includes('--list')) return overrides.toc ?? toc;
    if (sql.includes('ban-tools:identity')) return JSON.stringify({ database: overrides.identityDb ?? 'postgres', user: 'ban_user',
      version: overrides.version ?? '170007', dataDirectory: '/var/lib/postgresql/data', sharedBuffers: 128e6,
      databases: overrides.databases ?? [{ name: 'ban', bytes: 1e9 }, { name: 'postgres', bytes: 1e7 }] });
    if (sql.includes('ban-tools:extensions')) return JSON.stringify(overrides.extensions ?? ['postgis', 'btree_gist']);
    if (sql.includes('SELECT EXISTS')) return overrides.race ? 't' : 'f';
    if (sql.includes('SELECT current_database()')) return args.find(a => a.startsWith('--dbname=')).slice(9);
    if (sql.includes('CREATE DATABASE')) { if (overrides.createFails) throw Error('creation failed'); return ''; }
    if (sql.includes('ban-tools:inventory')) return JSON.stringify({ ...inventory, ...overrides.inventory });
    if (sql.includes('SELECT count(*)')) return '42';
    if (args.includes('sh') && args.some(a => a.includes('printf exists'))) return overrides.archiveExists ? 'exists' : 'absent';
    if (args.includes('sh') || args.includes('pg_restore')) {
      if (overrides.operationFails) throw Error('simulated failure');
      return '';
    }
    throw Error(`Unexpected mock command: ${JSON.stringify(args)}`);
  };
  const options = (command = 'restore', extra = []) => parseArgs([command, '--target', 'ban_restore', '--archive', '/backups/archive.dump',
    '--report-directory', reportDirectory, ...extra], {});
  return { calls, output, reportDirectory, options, dependencies: { docker, print: s => output.push(s), confirm: async () => 'RESTAURER ban_restore' } };
}
const writes = calls => calls.filter(c => c.args.some(a => a.includes('CREATE DATABASE') || a.includes('exec pg_dump'))
  || (c.args.includes('pg_restore') && !c.args.includes('--list') && !c.args.includes('--version')));

test('options : -y ne signifie pas silence ; défauts et identifiants explicites', () => {
  const o = parseArgs(['restore', '--target', 'ban_restore', '--archive', '/backups/test.dump', '-y'], {});
  assert.equal(o.yes, true); assert.equal(o.dryRun, false); assert.equal(o.current, 'ban');
  for (const target of ['ban', 'postgres', 'template0', 'template1', 'bad;DROP', '../path']) {
    assert.throws(() => parseArgs(['restore', '--target', target, '--archive', '/x', '-y'], {}));
  }
  assert.throws(() => parseArgs(['restore', '--current', 'ban_live', '--target', 'ban_live', '--archive', '/x', '-y'], {}), /protégée/);
  assert.throws(() => parseArgs(['restore', '--source', 'archive_source', '--target', 'archive_source', '--archive', '/x'], {}), /protégée/);
  for (const args of [['--silence'], ['--jobs', '0'], ['--jobs', '1.5'], ['--jobs', '99'], ['--port', 'bad'], ['--reserve-gb', '-1'], ['--archive', 'relative']]) {
    assert.throws(() => parseArgs(['restore', '--target', 'candidate', '--archive', '/x', ...args], {}));
  }
});

test('disque : unités décimales, réserve, WAL/temporaires et chemins espacés', () => {
  assert.deepEqual(parseDf('Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/data 1000 400 600 40% /path with space'),
    { filesystem: '/dev/data', total: 1024000, free: 614400, mountedOn: '/path with space' });
  assert.equal(estimateSpace({ command: 'restore', reserveGb: 5, overheadPercent: 100 }, 1e9).required, 7e9);
  assert.equal(estimateSpace({ command: 'backup', reserveGb: 5 }, 1e9).required, 6.2e9);
  assert.throws(() => estimateSpace({ command: 'restore', reserveGb: 5, overheadPercent: 100 }, NaN));
});

test('dry-run + yes : lectures seules, aucun fichier, cibles et espace estimé toujours visibles', async t => {
  const f = fixture(t);
  f.dependencies.confirm = () => { throw Error('No prompt expected'); };
  const report = await run(f.options('restore', ['--dry-run', '-y']), f.dependencies);
  assert.equal(writes(f.calls).length, 0);
  assert.equal(fs.existsSync(f.reportDirectory), false);
  assert.equal(report.space.required, 7e9);
  assert.ok(f.output.some(s => s.includes('Base applicative PROTÉGÉE : ban')));
  assert.ok(f.output.some(s => s.includes('Espace SUPPLÉMENTAIRE requis estimé')));
  assert.ok(f.output.some(s => s.includes('Docker Desktop')));
  for (const c of f.calls.filter(c => c.args.includes('psql'))) {
    assert.ok(c.args.includes('--host=/var/run/postgresql'));
    assert.ok(c.args.some(a => a.includes('default_transaction_read_only=on')));
  }
});

for (const [name, overrides, pattern] of [
  ['cible existante', { databases: [{ name: 'ban', bytes: 1e9 }, { name: 'ban_restore', bytes: 2e9 }] }, /déjà présente/],
  ['identité différente', { identityDb: 'unexpected' }, /administrative/],
  ['espace insuffisant', { freeKb: 1000 }, /Espace insuffisant/],
  ['version antérieure', { version: '160001' }, /Version serveur/],
  ['extension absente', { extensions: ['postgis'] }, /btree_gist/],
  ['format invalide', { toc: '; Format: TAR' }, /custom/],
]) test(`--yes reste bloqué : ${name}`, async t => {
  const f = fixture(t, overrides);
  await assert.rejects(run(f.options('restore', ['-y']), f.dependencies), pattern);
  assert.equal(writes(f.calls).length, 0);
  assert.equal(fs.existsSync(f.reportDirectory), false);
});

test('empreinte attendue contrôlée avant toute écriture', async t => {
  const f = fixture(t);
  await assert.rejects(run(f.options('restore', ['--sha256', 'b'.repeat(64), '-y']), f.dependencies), /SHA-256/);
  assert.equal(writes(f.calls).length, 0);
});

test('refus humain : aucun fichier ni opération SQL', async t => {
  const f = fixture(t);
  f.dependencies.confirm = async () => 'non';
  await assert.rejects(run(f.options(), f.dependencies), /Confirmation refusée/);
  assert.equal(writes(f.calls).length, 0); assert.equal(fs.existsSync(f.reportDirectory), false);
});

for (const [name, overrides, pattern] of [
  ['base apparue', { race: true }, /apparue/],
  ['archive modifiée', { changedArchive: true }, /Archive modifiée/],
]) test(`contrôle répété après confirmation : ${name}`, async t => {
  const f = fixture(t, overrides);
  await assert.rejects(run(f.options(), f.dependencies), pattern);
  assert.equal(writes(f.calls).length, 0);
});

test('restore : création sur postgres, identité cible puis pg_restore isolé et rapport', async t => {
  const f = fixture(t);
  const report = await run(f.options('restore', ['-y']), f.dependencies);
  const commands = writes(f.calls);
  assert.equal(commands.length, 2);
  assert.ok(commands[0].args.includes('--dbname=postgres'));
  assert.ok(commands[0].args.some(a => a.includes('CREATE DATABASE "ban_restore"')));
  assert.ok(commands[1].args.includes('--dbname=ban_restore'));
  for (const flag of ['--no-owner', '--no-acl', '--no-tablespaces', '--exit-on-error', '--jobs=2']) assert.ok(commands[1].args.includes(flag));
  assert.ok(!commands[1].args.includes('--clean')); assert.ok(!commands[1].args.includes('--create'));
  assert.equal(report.status, 'success');
  assert.equal(fs.readdirSync(f.reportDirectory).length, 1);
  assert.ok(f.output.some(s => s.includes('--yes : confirmation acceptée')));
});

test('deux volumes : provision séparée, jamais somme des espaces libres', async t => {
  const f = fixture(t, { separateWal: true, freeKb: 5_000_000 });
  await assert.rejects(run(f.options('restore', ['-y']), f.dependencies), /besoin total estimé/);
  assert.equal(writes(f.calls).length, 0);
});

test('échec de restore : rapport conservé et aucune suppression/reprise', async t => {
  const f = fixture(t, { operationFails: true });
  await assert.rejects(run(f.options('restore', ['-y']), f.dependencies), /simulated failure/);
  const subdir = fs.readdirSync(f.reportDirectory)[0];
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.reportDirectory, subdir, 'report.json'))).status, 'failed');
  assert.ok(!f.calls.some(c => c.args.some(a => /DROP DATABASE|TRUNCATE|migrate/.test(a))));
});

test('backup : aucune archive écrasée, même avec --yes', async t => {
  const f = fixture(t, { archiveExists: true });
  await assert.rejects(run(f.options('backup', ['-y']), f.dependencies), /écrasement refusé/);
  assert.equal(writes(f.calls).length, 0);
});

test('backup : client pg_dump ancien refusé avant création du fichier', async t => {
  const f = fixture(t, { clientVersion: '16.1' });
  await assert.rejects(run(f.options('backup', ['-y']), f.dependencies), /pg_dump antérieur/);
  assert.equal(writes(f.calls).length, 0);
});

test('backup : réserve atomique noclobber, custom, empreinte et journal', async t => {
  const f = fixture(t);
  const report = await run(f.options('backup', ['-y']), f.dependencies);
  const [command] = writes(f.calls);
  assert.ok(command.args.some(a => a.includes('set -C; umask 077;')));
  assert.ok(command.args.some(a => a.includes('--format=custom --no-acl')));
  assert.ok(command.args.includes('--dbname=ban'));
  assert.equal(report.archive.sha256, 'a'.repeat(64));
});

test('backup : refuse un chemin sortant du montage, y compris par lien symbolique', async t => {
  const f = fixture(t, { archiveParent: '/tmp/private' });
  await assert.rejects(run(f.options('backup', ['-y']), f.dependencies), /hors montage/);
  assert.equal(writes(f.calls).length, 0);
  assert.equal(parseArgs(['backup', '--archive', '/backups/../tmp/test.dump'], {}).archive, '/tmp/test.dump');
});

test('backup : refuse un montage en lecture seule', async t => {
  const f = fixture(t, { mounts: [{ Type: 'volume', Source: '/vm/backups', Destination: '/backups', RW: false }] });
  await assert.rejects(run(f.options('backup', ['-y']), f.dependencies), /montage/);
  assert.equal(writes(f.calls).length, 0);
});

test('base applicative après bascule : protège son nouveau nom', async t => {
  assert.throws(() => parseArgs(['restore', '--current', 'ban_restore', '--target', 'ban_restore', '--archive', '/x', '-y'], {}), /protégée/);
  const f = fixture(t, { databases: [{ name: 'ban', bytes: 1e9 }, { name: 'ban_restore', bytes: 2e9 }] });
  const o = parseArgs(['restore', '--current', 'ban_restore', '--target', 'ban_restore_20261101', '--archive', '/backups/archive.dump',
    '--report-directory', f.reportDirectory, '--dry-run'], {});
  const report = await run(o, f.dependencies);
  assert.equal(report.currentDatabase, 'ban_restore'); assert.equal(report.sourceDatabase, 'ban_restore');
  assert.equal(report.space.referenceBytes, 2e9); assert.equal(writes(f.calls).length, 0);
});

test('check : SQL lecture seule, inventaire et comptes exacts optionnels', async t => {
  const f = fixture(t, { databases: [{ name: 'ban', bytes: 1e9 }, { name: 'ban_restore', bytes: 1e9 }] });
  const report = await run(f.options('check', ['--counts']), f.dependencies);
  assert.equal(writes(f.calls).length, 0); assert.equal(report.counts.address_h, '42');
  assert.equal(report.status, 'success');
});

test('check : index invalide signalé, code échec et rapport sans correction', async t => {
  const f = fixture(t, { databases: [{ name: 'ban', bytes: 1e9 }, { name: 'ban_restore', bytes: 1e9 }],
    inventory: { indexes: [{ name: 'test_gist', indisvalid: false, indisready: true }] } });
  await assert.rejects(run(f.options('check'), f.dependencies), /Contrôles à examiner/);
  const subdir = fs.readdirSync(f.reportDirectory)[0];
  const report = JSON.parse(fs.readFileSync(path.join(f.reportDirectory, subdir, 'report.json')));
  assert.deepEqual(report.issues, ['Index invalide/non prêt : test_gist']);
  assert.equal(writes(f.calls).length, 0);
});
