import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataExportRequestMessage } from './export/types.js';

// Mocks
// -----
// Ce fichier teste l'orchestration du handler RabbitMQ.
// Les dépendances lourdes sont mockées pour isoler l'ordre des actions :
// génération du fichier, stockage, mise à jour du statut, publication RabbitMQ.
const mocks = vi.hoisted(() => ({
  generateLocalExportFile: vi.fn(),
  storeExportFile: vi.fn(),
  markExportError: vi.fn(),
  markExportProcessing: vi.fn(),
  markExportSuccess: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

// Le logger est neutralisé pour garder les tests lisibles.
vi.mock('@ban/tools', () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
  },
}));

// La génération NDJSON est testée dans export/generate.test.ts.
// Ici, elle renvoie seulement un résultat connu pour vérifier le chaînage.
vi.mock('./export/generate.js', () => ({
  generateLocalExportFile: mocks.generateLocalExportFile,
}));

// Le stockage local/S3 est testé dans export/storage.test.ts.
// Ici, on vérifie seulement que le handler transmet les bons paramètres
// et utilise le résultat de stockage dans le rapport final.
vi.mock('./export/storage.js', () => ({
  storeExportFile: mocks.storeExportFile,
}));

// Les écritures en base sur ban.job_status sont mockées : ce test ne vérifie
// pas PostgreSQL, seulement que le handler appelle la bonne transition.
vi.mock('./export/status.js', () => ({
  markExportError: mocks.markExportError,
  markExportProcessing: mocks.markExportProcessing,
  markExportSuccess: mocks.markExportSuccess,
}));

const { handleExportRequest } = await import('./handleExportRequest.js');

// Fixture
// -------
// Message RabbitMQ représentatif d'une demande d'export différentiel.
const message = {
  token: 'export-token',
  exportType: 'diff',
  params: {
    format: 'raw',
    dataTypes: ['address'],
    departements: ['33'],
    address_ids: null,
    common_toponym_ids: null,
    district_ids: null,
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-01-31T00:00:00.000Z',
  },
} satisfies DataExportRequestMessage;

// Tests
// -----
describe('handleExportRequest', () => {
  // Préparation commune
  // -------------------
  // Chaque test démarre avec des mocks remis à zéro et un scénario nominal :
  // un fichier local généré, puis stocké sur S3.
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.generateLocalExportFile.mockResolvedValue({
      filePath: '/tmp/export.ndjson',
      stats: {
        count: 2,
        output: {
          storage: 'local',
          path: '/tmp/export.ndjson',
        },
      },
    });
    mocks.storeExportFile.mockResolvedValue({
      storage: 's3',
      bucket: 'ban-exports',
      key: 'exports/diff/export-token/export-token.diff.raw.ndjson',
      endpoint: 'https://s3.gra.io.cloud.ovh.net',
      size: 123,
    });
  });

  // Succès : le handler doit marquer le job en processing, générer le fichier,
  // le stocker, enregistrer le succès puis publier export.completed.
  it('marks the export as successful and publishes a completed event', async () => {
    const broker = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as any;

    await handleExportRequest(broker, message);

    expect(mocks.markExportProcessing).toHaveBeenCalledWith('export-token');
    expect(mocks.generateLocalExportFile).toHaveBeenCalledWith(
      'export-token',
      'diff',
      message.params
    );
    expect(mocks.storeExportFile).toHaveBeenCalledWith({
      token: 'export-token',
      exportType: 'diff',
      params: message.params,
      filePath: '/tmp/export.ndjson',
    });
    expect(mocks.markExportSuccess).toHaveBeenCalledWith(
      'export-token',
      {
        count: 2,
        output: {
          storage: 's3',
          bucket: 'ban-exports',
          key: 'exports/diff/export-token/export-token.diff.raw.ndjson',
          endpoint: 'https://s3.gra.io.cloud.ovh.net',
          size: 123,
        },
      },
      2
    );
    expect(broker.publish).toHaveBeenCalledWith('export.completed', {
      token: 'export-token',
      exportType: 'diff',
      status: 'success',
      report: {
        count: 2,
        output: {
          storage: 's3',
          bucket: 'ban-exports',
          key: 'exports/diff/export-token/export-token.diff.raw.ndjson',
          endpoint: 'https://s3.gra.io.cloud.ovh.net',
          size: 123,
        },
      },
    });
  });

  // Échec : si une étape lève une erreur, le handler doit enregistrer l'échec,
  // publier export.failed, puis relancer l'erreur pour laisser Rascal appliquer
  // la stratégie de retry/recovery du consumer.
  it('marks the export as failed and publishes a failed event', async () => {
    const error = new Error('export failed');
    const broker = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as any;
    mocks.generateLocalExportFile.mockRejectedValue(error);

    await expect(handleExportRequest(broker, message)).rejects.toThrow(error);

    expect(mocks.markExportError).toHaveBeenCalledWith(
      'export-token',
      error,
      {
        exportType: 'diff',
        params: message.params,
      }
    );
    expect(broker.publish).toHaveBeenCalledWith('export.failed', {
      token: 'export-token',
      exportType: 'diff',
      status: 'error',
      error: 'export failed',
    });
  });
});
