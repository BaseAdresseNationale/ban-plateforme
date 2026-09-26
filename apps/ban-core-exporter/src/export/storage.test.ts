import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks
// -----
// Vitest remonte les vi.mock() avant les imports du module testé.
// vi.hoisted() permet donc de déclarer des fonctions de mock réutilisables
// dans les factories vi.mock() et dans les assertions des tests.
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  loggerWarn: vi.fn(),
}));

// Le SDK S3 est remplacé par un faux client en mémoire.
// Objectif du test : vérifier la commande préparée pour S3 sans faire de
// requête réseau vers OVH ou AWS.
vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: class FakePutObjectCommand {
    constructor(public input: Record<string, unknown>) {}
  },
  S3Client: class FakeS3Client {
    send = mocks.send;
  },
}));

// Le logger est mocké pour vérifier le warning du fallback local en dev
// sans écrire inutilement dans la sortie de test.
vi.mock('@ban/tools', () => ({
  logger: {
    warn: mocks.loggerWarn,
  },
}));

const { getExportStorageConfig, storeExportFile } = await import('./storage.js');

// Fixtures et préparation
// -----------------------
// Les variables d'environnement listées ici sont nettoyées avant chaque test.
// Cela évite qu'un .env local ou un test précédent influence le scénario testé.
const envKeys = [
  'NODE_ENV',
  'EXPORT_STORAGE',
  'EXPORT_S3_BUCKET',
  'EXPORT_S3_ENDPOINT',
  'EXPORT_S3_REGION',
  'EXPORT_S3_ACCESS_KEY_ID',
  'EXPORT_S3_SECRET_ACCESS_KEY',
  'EXPORT_S3_PREFIX',
  'EXPORT_S3_PUBLIC_BASE_URL',
];

// Tests
// -----
describe('export storage', () => {
  const previousEnv = { ...process.env };
  let tmpDir: string;
  let filePath: string;

  beforeEach(async () => {
    process.env = { ...previousEnv };
    envKeys.forEach(key => delete process.env[key]);
    mocks.send.mockReset();
    mocks.loggerWarn.mockReset();
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ban-core-export-storage-'));
    filePath = path.join(tmpDir, 'export-token.ban.raw.ndjson');
    await writeFile(filePath, '{"meta":{"note":"stream-start"}}\n');
  });

  afterEach(async () => {
    process.env = previousEnv;
    await rm(tmpDir, { recursive: true, force: true });
  });

  // En développement, l'absence de configuration S3 ne doit pas bloquer
  // l'équipe : le service conserve alors le fichier généré localement.
  it('keeps local storage in development when S3 is not configured', () => {
    process.env.NODE_ENV = 'development';

    expect(getExportStorageConfig()).toEqual({ storage: 'local' });
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      '[ban-core-exporter] Missing S3 export configuration, keeping export file locally'
    );
  });

  // En production, un export sans destination S3 configurée serait perdu côté
  // utilisateur. Le service doit donc échouer explicitement au lieu de fallback.
  it('requires S3 configuration in production', () => {
    process.env.NODE_ENV = 'production';

    expect(() => getExportStorageConfig()).toThrow('Missing S3 export configuration');
  });

  // Ce test vérifie le contrat avec S3 : bucket, clé objet, taille, type de
  // contenu et metadata. Le client S3 reste mocké, donc aucun upload réel.
  it('uploads export files to S3 when configured', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EXPORT_S3_BUCKET = 'ban-exports';
    process.env.EXPORT_S3_ENDPOINT = 'https://s3.gra.io.cloud.ovh.net';
    process.env.EXPORT_S3_REGION = 'gra';
    process.env.EXPORT_S3_ACCESS_KEY_ID = 'access-key';
    process.env.EXPORT_S3_SECRET_ACCESS_KEY = 'secret-key';
    process.env.EXPORT_S3_PREFIX = 'custom-exports';
    process.env.EXPORT_S3_PUBLIC_BASE_URL = 'https://exports.example.test';
    mocks.send.mockResolvedValue({});

    const output = await storeExportFile({
      token: 'export-token',
      exportType: 'ban',
      params: {
        format: 'raw',
        dataTypes: ['district'],
        departements: ['33'],
        address_ids: null,
        common_toponym_ids: null,
        district_ids: null,
        at: '2026-01-31T00:00:00.000Z',
      },
      filePath,
    });

    expect(output).toEqual({
      storage: 's3',
      bucket: 'ban-exports',
      key: 'custom-exports/ban/export-token/export-token.ban.raw.ndjson',
      endpoint: 'https://s3.gra.io.cloud.ovh.net',
      url: 'https://exports.example.test/custom-exports/ban/export-token/export-token.ban.raw.ndjson',
      size: 33,
    });
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send.mock.calls[0][0].input).toMatchObject({
      Bucket: 'ban-exports',
      Key: 'custom-exports/ban/export-token/export-token.ban.raw.ndjson',
      ContentLength: 33,
      ContentType: 'application/x-ndjson',
      Metadata: {
        token: 'export-token',
        'export-type': 'ban',
        format: 'raw',
      },
    });
  });
});
