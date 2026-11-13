#!/usr/bin/env node
// Outils locaux : cibles explicites, aucune suppression, confirmation après précontrôles.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const GB = 1_000_000_000;
const SYSTEM_DATABASES = ['postgres', 'template0', 'template1'];
const SQL_NAME = /^[a-z_][a-z0-9_]{0,62}$/;
const HELP = `Usage : node scripts/postgresql/postgresql.mjs <backup|restore|check> [options]
  --container NOM          Conteneur local (POSTGRES_CONTAINER, défaut ban_postgres)
  --username ROLE          Rôle PostgreSQL (PG_USERNAME, défaut ban_user)
  --socket-directory DIR  Socket Unix DANS le conteneur (défaut /var/run/postgresql)
  --port N                Port PostgreSQL local au conteneur (défaut 5432)
  --current DATABASE       Base applicative protégée (CURRENT_DATABASE, défaut ban)
  --source DATABASE        Base à sauvegarder / référence de taille (défaut --current)
  --target DATABASE        Nouvelle base ; obligatoire pour restore et check
  --archive /CHEMIN.dump   Archive custom DANS le conteneur ; obligatoire hors check
  --report-directory DIR  Rapports sur l'hôte (défaut working/postgresql)
  --estimated-database-gb N Taille estimée de la candidate, données ET index, en Go
  --overhead-percent N     Provision temporaires/WAL (défaut 100 % de cette taille)
  --reserve-gb N           Espace libre à conserver (défaut 5 Go)
  --jobs N                Sessions pg_restore (défaut 2)
  --maintenance-mb N      maintenance_work_mem par session (défaut 256 Mo binaires)
  --work-mb N             work_mem par opération (défaut 16 Mo binaires)
  --sha256 HEX            Empreinte attendue de l'archive avant restauration
  --counts                Comptages exacts des huit tables BAN principales (check)
  --query-timeout-seconds N Limite par requête SQL en lecture (défaut 30)
  --dry-run               Précontrôles en lecture seule, aucune écriture ni confirmation
  --yes, -y               Accepter la confirmation ; conserve tous les garde-fous
  --help, -h              Afficher cette aide
Les Go affichés valent 1 000 000 000 octets. Aucune lecture automatique des .env.
Les scripts locaux omettent les ACL et restaurent sans propriétaires ni tablespaces.
Une reprise des droits de production relève du guide dédié.`;

function positive(value, label, max = Number.MAX_SAFE_INTEGER, allowZero = false) {
  const n = Number(value);
  assert.ok(Number.isFinite(n) && (allowZero ? n >= 0 : n > 0) && n <= max,
    `${label} : nombre ${allowZero ? 'positif ou nul' : 'strictement positif'} attendu`);
  return n;
}

export function parseArgs(argv, env = process.env) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const command = argv[0];
  assert.ok(['backup', 'restore', 'check'].includes(command), HELP);
  const options = { command, container: env.POSTGRES_CONTAINER || 'ban_postgres',
    username: env.PG_USERNAME || 'ban_user', current: env.CURRENT_DATABASE || 'ban',
    socketDirectory: '/var/run/postgresql', port: 5432, queryTimeoutSeconds: 30,
    reportDirectory: path.resolve('working/postgresql'), jobs: 2, maintenanceMb: 256,
    workMb: 16, overheadPercent: 100, reserveGb: 5, dryRun: false, yes: false, counts: false };
  const values = { '--container': 'container', '--username': 'username', '--current': 'current',
    '--socket-directory': 'socketDirectory', '--port': 'port', '--query-timeout-seconds': 'queryTimeoutSeconds',
    '--source': 'source', '--target': 'target', '--archive': 'archive',
    '--report-directory': 'reportDirectory', '--estimated-database-gb': 'estimatedDatabaseGb',
    '--overhead-percent': 'overheadPercent', '--reserve-gb': 'reserveGb', '--jobs': 'jobs',
    '--maintenance-mb': 'maintenanceMb', '--work-mb': 'workMb', '--sha256': 'sha256' };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--counts') options.counts = true;
    else {
      assert.ok(Object.hasOwn(values, arg), `Option inconnue : ${arg}`);
      assert.ok(argv[i + 1] && !argv[i + 1].startsWith('-'), `Valeur manquante : ${arg}`);
      options[values[arg]] = argv[++i];
    }
  }
  options.source ??= options.current;
  for (const key of ['current', 'source', 'username']) {
    assert.ok(SQL_NAME.test(options[key]), `Identifiant SQL invalide : ${key}`);
  }
  assert.ok(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(options.container), 'Conteneur invalide');
  assert.ok(options.socketDirectory.startsWith('/') && !/[\r\n\0]/.test(options.socketDirectory), 'Socket Unix absolu requis');
  if (command !== 'check') {
    assert.ok(options.archive?.startsWith('/') && !/[\r\n\0]/.test(options.archive),
      '--archive : chemin absolu dans le conteneur requis');
    options.archive = path.posix.normalize(options.archive);
  }
  if (command !== 'backup') {
    assert.ok(SQL_NAME.test(options.target ?? ''), '--target : identifiant SQL explicite requis');
  }
  if (command === 'restore') {
    assert.ok(!['ban', options.current, options.source, ...SYSTEM_DATABASES].includes(options.target),
      'Cible protégée : choisir une nouvelle base distincte de la base courante et de la source');
  }
  options.jobs = positive(options.jobs, '--jobs', 32);
  options.port = positive(options.port, '--port', 65535);
  options.queryTimeoutSeconds = positive(options.queryTimeoutSeconds, '--query-timeout-seconds', 3600);
  options.maintenanceMb = positive(options.maintenanceMb, '--maintenance-mb', 65536);
  options.workMb = positive(options.workMb, '--work-mb', 65536);
  for (const key of ['jobs', 'maintenanceMb', 'workMb', 'port', 'queryTimeoutSeconds']) assert.ok(Number.isInteger(options[key]), `${key} : entier requis`);
  options.overheadPercent = positive(options.overheadPercent, '--overhead-percent', 1000, true);
  options.reserveGb = positive(options.reserveGb, '--reserve-gb', 10000, true);
  if (options.estimatedDatabaseGb !== undefined) options.estimatedDatabaseGb = positive(options.estimatedDatabaseGb, '--estimated-database-gb');
  if (options.sha256) assert.match(options.sha256, /^[a-fA-F0-9]{64}$/, '--sha256 invalide');
  options.reportDirectory = path.resolve(options.reportDirectory);
  return options;
}

// Pas de shell hôte : les arguments restent des arguments, y compris les chemins espacés.
async function dockerCommand(args, { log, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    // Ouvre le journal avant de lancer une opération : une erreur locale doit l'empêcher.
    const logFd = log ? fs.openSync(log, 'wx', 0o600) : null;
    const child = spawn('docker', args, { stdio: ['ignore', logFd ?? 'pipe', logFd ?? 'pipe'] });
    let stdout = '', stderr = '';
    const timer = timeout ? setTimeout(() => { child.kill('SIGTERM'); }, timeout) : null;
    let failure;
    child.stdout?.on('data', data => {
      stdout += data; if (stdout.length > 64 * 1024 * 1024) { failure = Error('Sortie trop volumineuse'); child.kill('SIGTERM'); }
    });
    child.stderr?.on('data', data => { stderr = (stderr + data).slice(-4000); });
    child.on('error', error => { failure = error; });
    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (logFd !== null) fs.closeSync(logFd);
      if (failure || code !== 0) reject(failure || Error(`docker : échec (${code ?? signal}). ${log ? `Journal : ${log}` : stderr}`));
      else resolve(stdout.trim());
    });
  });
}

export function parseDf(output) {
  const columns = output.trim().split('\n').at(-1).trim().split(/\s+/);
  assert.ok(columns.length >= 6 && /^\d+$/.test(columns[3]), 'Sortie df illisible');
  return { filesystem: columns[0], total: Number(columns[1]) * 1024,
    free: Number(columns[3]) * 1024, mountedOn: columns.slice(5).join(' ') };
}

export function estimateSpace(options, referenceBytes) {
  assert.ok(Number.isSafeInteger(referenceBytes) && referenceBytes > 0, 'Taille de référence indisponible : fournir --estimated-database-gb');
  const reserve = Math.ceil(options.reserveGb * GB);
  const overhead = options.command === 'backup' ? Math.ceil(referenceBytes * 0.2)
    : Math.ceil(referenceBytes * options.overheadPercent / 100);
  const required = referenceBytes + overhead + reserve;
  assert.ok(Number.isSafeInteger(required), 'Espace requis trop grand pour une estimation exacte en octets');
  return { referenceBytes, overhead, reserve, required };
}

function hostDisk(directory) {
  let existing = directory;
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  const s = fs.statfsSync(existing);
  return { path: existing, free: s.bavail * s.bsize };
}

const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const showCommand = args => `docker ${args.map(quote).join(' ')}`;
const formatBytes = bytes => `${bytes.toLocaleString('fr-FR')} octets (${(bytes / GB).toFixed(2)} Go)`;

const INVENTORY_SQL = `/* ban-tools:inventory */
SELECT json_build_object(
 'database', current_database(), 'user', current_user,
 'schemas', (SELECT coalesce(json_agg(nspname ORDER BY nspname),'[]') FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'),
 'extensions', (SELECT coalesce(json_agg(row_to_json(e)),'[]') FROM (SELECT extname,extversion FROM pg_extension ORDER BY extname) e),
 'tables', (SELECT coalesce(json_agg(row_to_json(t)),'[]') FROM (SELECT schemaname,relname,pg_total_relation_size(relid) AS bytes,n_live_tup AS estimated_rows FROM pg_stat_user_tables ORDER BY schemaname,relname) t),
 'constraints', (SELECT coalesce(json_agg(row_to_json(c)),'[]') FROM (SELECT n.nspname,c.conrelid::regclass::text AS relation,c.conname,c.contype,c.convalidated,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('ban','external') ORDER BY n.nspname,c.conname) c),
 'indexes', (SELECT coalesce(json_agg(row_to_json(i)),'[]') FROM (SELECT n.nspname,c.relname AS relation,x.relname AS name,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_class x ON x.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('ban','external') ORDER BY n.nspname,x.relname) i),
 'triggers', (SELECT coalesce(json_agg(row_to_json(t)),'[]') FROM (SELECT n.nspname,t.tgrelid::regclass::text AS relation,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('ban','external') AND NOT t.tgisinternal ORDER BY n.nspname,t.tgname) t),
 'ranges', (SELECT coalesce(json_agg(row_to_json(c)),'[]') FROM (SELECT table_schema,table_name,column_name,udt_name FROM information_schema.columns WHERE table_schema='ban' AND udt_name='tstzrange' ORDER BY table_name,column_name) c),
 'functions', (SELECT coalesce(json_agg(row_to_json(f)),'[]') FROM (SELECT p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('ban','external') ORDER BY signature) f),
 'sequences', (SELECT coalesce(json_agg(row_to_json(s)),'[]') FROM (SELECT schemaname,sequencename,sequenceowner,last_value FROM pg_sequences WHERE schemaname IN ('ban','external') ORDER BY schemaname,sequencename) s),
 'migrationRegistries', (SELECT coalesce(json_agg(n.nspname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='_prisma_migrations' AND c.relkind='r' AND n.nspname IN ('ban','public'))
);`;

export async function run(options, dependencies = {}) {
  const docker = dependencies.docker ?? dockerCommand;
  const print = dependencies.print ?? console.log;
  const confirm = dependencies.confirm ?? (async question => {
    assert.ok(process.stdin.isTTY, 'Entrée non interactive : utiliser --yes après examen du --dry-run');
    const reader = createInterface({ input: process.stdin, output: process.stdout });
    try { return await reader.question(question); } finally { reader.close(); }
  });
  if (options.help) { print(HELP); return; }
  const [container] = JSON.parse(await docker(['inspect', '--type=container', options.container]));
  assert.ok(container?.Id && container.State?.Running, 'Conteneur arrêté ou introuvable');
  const id = container.Id; // Épingle le conteneur inspecté ; un redémarrage concurrent ne change pas la cible.
  const exec = (...args) => ['exec', '--env', 'LC_ALL=C', id, ...args];
  const execWithPgOptions = (settings, ...args) => ['exec', '--env', 'LC_ALL=C', '--env', `PGOPTIONS=${settings}`, id, ...args];
  // Force le socket local : un PGHOST/PGSERVICE existant ne doit pas viser un autre serveur.
  const connection = [`--host=${options.socketDirectory}`, `--port=${options.port}`, `--username=${options.username}`];
  const psql = (db, sql) => docker(execWithPgOptions(`-c default_transaction_read_only=on -c statement_timeout=${options.queryTimeoutSeconds * 1000} -c lock_timeout=5000`,
    'psql', ...connection, `--dbname=${db}`, '--no-psqlrc', '--set=ON_ERROR_STOP=1',
    '--quiet', '--tuples-only', '--no-align', `--command=${sql}`), { timeout: (options.queryTimeoutSeconds + 10) * 1000 });
  const sqlJson = async (db, sql) => JSON.parse(await psql(db, sql));
  const info = await sqlJson('postgres', `/* ban-tools:identity */ SELECT json_build_object(
    'database',current_database(),'user',current_user,'version',current_setting('server_version_num'),
    'dataDirectory',current_setting('data_directory'),'sharedBuffers',pg_size_bytes(current_setting('shared_buffers')),
    'databases',(SELECT json_agg(json_build_object('name',datname,'bytes',CASE WHEN has_database_privilege(oid,'CONNECT') THEN pg_database_size(oid) ELSE NULL END) ORDER BY datname) FROM pg_database WHERE NOT datistemplate));`);
  assert.equal(info.database, 'postgres', 'Connexion administrative inattendue');
  assert.equal(info.user, options.username, 'Rôle connecté inattendu');
  const databases = info.databases ?? [];
  assert.ok(databases.some(d => d.name === options.current), 'Base applicative configurée absente : vérifier --current');
  if (options.command === 'restore') assert.ok(!databases.some(d => d.name === options.target), 'Base cible déjà présente : arrêt, choisir un autre nom');
  if (options.command === 'check') assert.ok(databases.some(d => d.name === options.target), 'Base à contrôler absente');
  const source = databases.find(d => d.name === options.source);
  if (options.command === 'backup') assert.ok(source, 'Base source à sauvegarder absente');
  const report = { command: options.command, timestamp: new Date().toISOString(),
    container: { id, name: options.container }, currentDatabase: options.current,
    sourceDatabase: options.source, targetDatabase: options.target, info, warnings: [] };
  print(`Opération : ${options.command} — conteneur ${options.container} (${id.slice(0, 12)})`);
  print(`Base applicative PROTÉGÉE : ${options.current} ; rôle : ${options.username}`);
  print(`Source : ${options.source} ; cible : ${options.target ?? 'archive seule'}`);
  if (options.command !== 'check') print(`Archive (dans le conteneur) : ${options.archive}`);
  print(`Socket PostgreSQL : ${options.socketDirectory} ; port : ${options.port} (dans le conteneur)`);
  print(`Version serveur : ${info.version} (server_version_num)`);
  if (options.command !== 'check') {
    const program = options.command === 'backup' ? 'pg_dump' : 'pg_restore';
    const client = await docker(exec(program, '--version'));
    print(`Client : ${client}`);
    report.clientVersion = client;
    if (options.command === 'backup') {
      const major = Number(client.match(/PostgreSQL\)?\s+(\d+)/)?.[1]);
      assert.ok(major >= Math.floor(Number(info.version) / 10000), 'pg_dump antérieur au serveur source');
    }
  }
  for (const database of databases) print(`Base existante : ${database.name} — ${database.bytes === null ? 'taille non accessible' : formatBytes(Number(database.bytes))}`);
  const warn = message => { report.warnings.push(message); print(`AVERTISSEMENT : ${message}`); };
  const disks = new Map();
  async function disk(label, directory) {
    const value = { label, path: directory, ...parseDf(await docker(exec('df', '-Pk', '--', directory))) };
    report.disks ??= [];
    report.disks.push(value);
    // Plusieurs chemins peuvent partager la même capacité : ne jamais additionner les libres.
    disks.set(value.filesystem, value);
    print(`Disque ${label} : ${directory} — ${formatBytes(value.free)} libres (${value.filesystem})`);
    return value;
  }
  const dataDisk = await disk('PostgreSQL', info.dataDirectory);
  const walPath = await docker(exec('readlink', '-f', '--', path.posix.join(info.dataDirectory, 'pg_wal')));
  const walDisk = await disk('WAL', walPath);
  const mounts = (container.Mounts ?? []).filter(m => [info.dataDirectory, walPath, options.archive]
    .some(p => p && (p === m.Destination || p.startsWith(m.Destination.replace(/\/$/, '') + '/'))));
  report.mounts = mounts.map(m => ({ type: m.Type, source: m.Source, destination: m.Destination, writable: m.RW }));
  for (const mount of report.mounts) {
    print(`Montage ${mount.type} : ${mount.source} → ${mount.destination} (${mount.writable ? 'écriture' : 'lecture seule'})`);
    if (mount.type === 'bind' && fs.existsSync(mount.source)) {
      print(`Disque hôte du montage : ${formatBytes(hostDisk(mount.source).free)} libres (pas une capacité additionnelle)`);
    }
  }
  const host = hostDisk(options.reportDirectory);
  assert.ok(host.free >= 1024 * 1024, 'Moins de 1 Mo libre pour les rapports hôte');
  report.hostDisk = host;
  print(`Disque hôte des rapports : ${host.path} — ${formatBytes(host.free)} libres`);
  try {
    const engine = JSON.parse(await docker(['info', '--format', '{{json .}}']));
    const usage = JSON.parse(await docker(['stats', '--no-stream', '--format', '{{json .}}', id]));
    report.memory = { engineBytes: engine.MemTotal, containerLimitBytes: container.HostConfig?.Memory ?? 0,
      usage: usage.MemUsage, hostFreeBytes: os.freemem() };
    print(`Mémoire : moteur Docker ${formatBytes(engine.MemTotal)} ; limite conteneur ${container.HostConfig?.Memory ? formatBytes(container.HostConfig.Memory) : 'non définie (partagée avec Docker)'}`);
    print(`Utilisation actuelle du conteneur : ${usage.MemUsage} ; shared_buffers : ${formatBytes(Number(info.sharedBuffers))}`);
  } catch { warn('Mesure mémoire Docker indisponible ; capacité RAM utilisable non déterminée.'); }
  if (options.command === 'restore') {
    const configured = options.jobs * (options.maintenanceMb + options.workMb) * 1024 * 1024;
    print(`Restauration : ${options.jobs} sessions ; maintenance_work_mem=${options.maintenanceMb}MB ; work_mem=${options.workMb}MB`);
    print(`Repère mémoire jobs × (maintenance + work) : ${formatBytes(configured)} ; ce calcul n’est PAS un plafond (opérations multiples, workers, caches et application en supplément).`);
  }
  warn('Docker Desktop / WSL : si le stockage est virtualisé, vérifier aussi les limites de la VM et le libre sur son disque hôte (réglages Resources selon l’installation). Le libre VM/hôte ne se cumule pas ; sous Docker Engine natif, contrôler le disque physique des volumes.');
  let fingerprint;
  if (options.command !== 'check') {
    assert.ok(source || options.estimatedDatabaseGb !== undefined, 'Source absente : fournir une estimation explicite --estimated-database-gb');
    const referenceBytes = options.estimatedDatabaseGb !== undefined
      ? Math.ceil(options.estimatedDatabaseGb * GB) : Number(source?.bytes);
    report.space = estimateSpace(options, referenceBytes);
    print(`Référence données + index : ${formatBytes(referenceBytes)} (${options.estimatedDatabaseGb !== undefined ? 'estimation fournie' : `base ${options.source}`})`);
    warn('La taille de la base source n’est qu’un repère pour cette archive ; compression, données historiques et structure peuvent différer. Ajuster --estimated-database-gb si nécessaire.');
    print(`Provision ${options.command === 'restore' ? 'temporaires/WAL' : 'archive au-delà de la référence (+20 %)'} : ${formatBytes(report.space.overhead)} ; réserve : ${formatBytes(report.space.reserve)}`);
    print(`Espace SUPPLÉMENTAIRE requis estimé : ${formatBytes(report.space.required)}. Les bases et archives présentes sont déjà comptées dans l’occupation.`);
    if (options.command === 'restore') {
      await docker(exec('test', '-f', options.archive));
      fingerprint = await docker(exec('stat', '--dereference', '--format=%d:%i:%s:%Y:%Z', '--', options.archive));
      const archiveBytes = Number(fingerprint.split(':')[2]);
      assert.ok(Number.isSafeInteger(archiveBytes) && archiveBytes > 0, 'Archive vide ou taille inaccessible');
      print(`Poids de l’archive : ${formatBytes(archiveBytes)} (compressé ; distinct de la taille restaurée)`);
      const list = await docker(exec('pg_restore', '--list', options.archive));
      assert.match(list, /Format: CUSTOM/i, 'Archive custom requise');
      const dumpVersion = list.match(/Dumped from database version: (\d+)/i)?.[1];
      assert.ok(dumpVersion && Number(info.version) / 10000 >= Number(dumpVersion), 'Version serveur cible antérieure ou version source inconnue');
      report.archive = { path: options.archive, bytes: archiveBytes, fingerprint, toc: list };
      const available = await sqlJson('postgres', `/* ban-tools:extensions */ SELECT coalesce(json_agg(name),'[]') FROM pg_available_extensions;`);
      for (const name of ['postgis', 'btree_gist']) {
        if (new RegExp(`EXTENSION\\s+-\\s+${name}\\b`).test(list)) assert.ok(available.includes(name), `Extension indisponible : ${name}`);
      }
      if (options.sha256) {
        const actual = (await docker(exec('sha256sum', '--', options.archive))).split(/\s+/)[0];
        assert.equal(actual.toLowerCase(), options.sha256.toLowerCase(), 'Empreinte SHA-256 différente');
      } else warn('Aucune empreinte de confiance fournie (--sha256). Le contenu SQL doit provenir d’une source de confiance.');
      if (dataDisk.filesystem === walDisk.filesystem) {
        assert.ok(dataDisk.free >= report.space.required, 'Espace insuffisant pour les données/index/temporaires/WAL et la réserve estimés');
      } else {
        // Provision globale sur chaque volume : volontairement prudente, pas une répartition prédite.
        for (const d of [dataDisk, walDisk]) assert.ok(d.free >= report.space.required, `Espace insuffisant sur ${d.label} (besoin total estimé vérifié sur chaque volume)`);
      }
      warn('La provision est une hypothèse de dimensionnement, pas une borne maximale des WAL ou fichiers temporaires. Les slots de réplication, archivages bloqués et écritures applicatives peuvent accroître le besoin.');
    } else {
      assert.equal(await docker(exec('sh', '-c', 'if [ -e "$1" ] || [ -L "$1" ]; then printf exists; else printf absent; fi', '_', options.archive)), 'absent', 'Archive déjà présente : écrasement refusé');
      const parent = await docker(exec('readlink', '-f', '--', path.posix.dirname(options.archive)));
      await docker(exec('test', '-w', parent));
      const archiveDisk = await disk('archive', parent);
      assert.ok(report.mounts.some(m => m.writable && (parent === m.destination || parent.startsWith(m.destination.replace(/\/$/, '') + '/'))),
        'Archive hors montage Docker accessible en écriture : préparer un montage durable');
      assert.ok(archiveDisk.free >= report.space.required, 'Espace insuffisant pour l’archive et la réserve estimées');
      warn('Une sauvegarde sur un serveur actif peut retenir des versions de lignes et consommer des ressources supplémentaires ; la provision archive ne plafonne pas cette croissance.');
    }
  }
  if (options.dryRun) { print('DRY-RUN terminé : aucune base créée, aucune archive ni aucun rapport écrit.'); return report; }
  if (options.command !== 'check') {
    const phrase = options.command === 'restore' ? `RESTAURER ${options.target}` : `SAUVEGARDER ${options.source}`;
    if (options.yes) print('--yes : confirmation acceptée ; contrôles de sécurité maintenus.');
    else assert.equal((await confirm(`Saisir « ${phrase} » pour continuer : `)).trim(), phrase, 'Confirmation refusée : aucune écriture');
    // Répète les contrôles critiques après le délai de relecture humaine.
    for (const disk of disks.values()) {
      if (options.command === 'backup' && disk.label !== 'archive') continue;
      assert.ok(parseDf(await docker(exec('df', '-Pk', '--', disk.path))).free >= report.space.required,
        `Espace devenu insuffisant : ${disk.path}`);
    }
    if (options.command === 'restore') {
      assert.equal(await psql('postgres', `SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname='${options.target}');`), 'f', 'Cible apparue entre-temps : arrêt');
      assert.equal(await docker(exec('stat', '--dereference', '--format=%d:%i:%s:%Y:%Z', '--', options.archive)), fingerprint, 'Archive modifiée pendant la confirmation : arrêt');
    }
  }
  fs.mkdirSync(options.reportDirectory, { recursive: true, mode: 0o700 });
  const directory = fs.mkdtempSync(path.join(options.reportDirectory, `${options.command}-${options.target ?? options.source}-`));
  fs.chmodSync(directory, 0o700);
  print(`Rapports et journal privés : ${directory}`);
  const writeReport = () => fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  writeReport();
  try {
    if (options.command === 'backup') {
      // noclobber réserve le fichier côté conteneur : un concurrent ne peut pas l'écraser.
      const args = exec('sh', '-c', 'set -C; umask 077; archive=$1; shift; exec pg_dump "$@" --format=custom --no-acl --verbose > "$archive"',
        '_', options.archive, ...connection, `--dbname=${options.source}`);
      assert.equal(await psql(options.source, 'SELECT current_database();'), options.source);
      print(showCommand(args));
      await docker(args, { log: path.join(directory, 'backup.log'), timeout: 0 });
      report.archive = { path: options.archive, toc: await docker(exec('pg_restore', '--list', options.archive)),
        sha256: (await docker(exec('sha256sum', '--', options.archive))).split(/\s+/)[0] };
      print(`SHA-256 : ${report.archive.sha256}`);
      print('Archive lisible ; restaurabilité complète à vérifier par une restauration isolée.');
    } else if (options.command === 'restore') {
      const create = exec('psql', ...connection, '--dbname=postgres', '--no-psqlrc', '--set=ON_ERROR_STOP=1',
        `--command=CREATE DATABASE "${options.target}" OWNER "${options.username}" TEMPLATE template0;`);
      print(`Création — cible : ${options.target}\n${showCommand(create)}`);
      await docker(create);
      assert.equal(await psql(options.target, 'SELECT current_database();'), options.target, 'Base réellement connectée différente');
      const args = execWithPgOptions(`-c maintenance_work_mem=${options.maintenanceMb}MB -c work_mem=${options.workMb}MB -c temp_tablespaces=`,
        'pg_restore', ...connection, `--dbname=${options.target}`, '--no-owner', '--no-acl', '--no-tablespaces',
        '--exit-on-error', `--jobs=${options.jobs}`, '--verbose', options.archive);
      print(`Restauration — cible : ${options.target}\n${showCommand(args)}`);
      await docker(args, { log: path.join(directory, 'restore.log'), timeout: 0 });
      print('Restauration terminée. Lancer check, auditer les migrations et tester avant toute bascule.');
    } else {
      report.inventory = await sqlJson(options.target, INVENTORY_SQL);
      assert.equal(report.inventory.database, options.target, 'Base réellement contrôlée différente');
      report.issues = [];
      for (const name of ['address', 'address_h', 'common_toponym', 'common_toponym_h', 'district', 'district_h', 'district_config', 'district_config_h']) {
        if (!report.inventory.tables.some(t => t.schemaname === 'ban' && t.relname === name)) report.issues.push(`Table absente : ban.${name}`);
      }
      for (const i of report.inventory.indexes) if (!i.indisvalid || !i.indisready) report.issues.push(`Index invalide/non prêt : ${i.name}`);
      for (const c of report.inventory.constraints) if (!c.convalidated) report.issues.push(`Contrainte non validée : ${c.conname}`);
      for (const t of report.inventory.triggers) if (t.tgenabled === 'D') report.issues.push(`Trigger désactivé : ${t.tgname}`);
      for (const name of ['postgis', 'btree_gist']) if (!report.inventory.extensions.some(e => e.extname === name)) report.issues.push(`Extension absente : ${name}`);
      if (options.counts) {
        report.counts = {};
        for (const t of report.inventory.tables.filter(t => t.schemaname === 'ban' && ['address','address_h','common_toponym','common_toponym_h','district','district_h','district_config','district_config_h'].includes(t.relname))) {
          report.counts[t.relname] = await psql(options.target, `SELECT count(*) FROM ban."${t.relname}";`);
        }
      }
      print(`Inventaire : ${report.inventory.tables.length} tables ; ${report.inventory.indexes.length} indexes ; ${report.inventory.functions.length} fonctions.`);
      for (const issue of report.issues) print(`À EXAMINER : ${issue}`);
      if (report.issues.length) throw Error('Contrôles à examiner : rapport enregistré, aucune correction automatique');
      print('Contrôles techniques réussis ; comparaison source/candidate, droits applicatifs et tests métier restent nécessaires.');
    }
    report.status = 'success';
  } catch (error) {
    report.status = 'failed';
    report.error = error.message;
    print('Échec : conserver archive, cible éventuelle et journaux pour diagnostic. Aucune suppression ni reprise automatique.');
    throw error;
  } finally { writeReport(); }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await run(parseArgs(process.argv.slice(2))); }
  catch (error) { console.error(`ARRÊT : ${error.message}`); process.exitCode = 1; }
}
