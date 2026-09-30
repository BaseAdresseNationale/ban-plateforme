import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('@ban/prisma-client', () => ({
  pool: {
    connect: mocks.connect,
  },
}));

vi.mock('@ban/tools', () => ({
  logger: {
    info: mocks.loggerInfo,
  },
}));

vi.mock('pg-cursor', () => ({
  default: class FakeCursor {
    rows: Record<string, unknown>[];

    constructor(public request: string, public params: unknown[]) {
      this.rows = [
        {
          snapshot_district_ndjson: JSON.stringify({
            type: 'district',
            nodeKey: 'DISTRICT:::11111111-1111-4111-8111-111111111111',
            data: {
              id: '11111111-1111-4111-8111-111111111111',
              labels: [{ isoCode: 'fra', value: 'Bordeaux' }],
              updateDate: '2026-01-15T00:00:00.000Z',
              meta: { insee: { cog: '33063' }, source: 'bal' },
            },
          }),
        },
      ];
    }

    read(_size: number, callback: (error: Error | null, rows: Record<string, unknown>[]) => void) {
      const rows = this.rows;
      this.rows = [];
      callback(null, rows);
    }

    close(callback: () => void) {
      callback();
    }
  },
}));

const { generateLocalExportFile } = await import('./generate.js');

describe('generateLocalExportFile', () => {
  let previousCwd: string;
  let tmpDir: string;
  const release = vi.fn();

  beforeEach(async () => {
    previousCwd = process.cwd();
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ban-core-exporter-'));
    process.chdir(tmpDir);
    release.mockReset();
    mocks.connect.mockReset();
    mocks.loggerInfo.mockReset();
    mocks.connect.mockResolvedValue({
      query: vi.fn(cursor => cursor),
      release,
    });
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a local NDJSON export file with metadata, data and stats', async () => {
    const result = await generateLocalExportFile(
      'export-token',
      'ban',
      {
        format: 'raw',
        dataTypes: ['district'],
        departements: ['33'],
        address_ids: null,
        common_toponym_ids: null,
        district_ids: null,
        at: '2026-01-31T00:00:00.000Z',
      }
    );

    expect(path.basename(result.filePath)).toBe('export-token.ban.raw.ndjson');
    expect(result.filePath).toContain(path.join('tmp', 'exports'));
    expect(result.stats).toMatchObject({
      output: {
        storage: 'local',
        path: result.filePath,
      },
      count: 1,
      stats: {
        district: {
          count: 1,
        },
      },
    });
    expect(release).toHaveBeenCalledOnce();

    const lines = (await readFile(result.filePath, 'utf8'))
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));

    expect(lines[0].meta.note).toBe('stream-start');
    expect(lines[0].meta).toMatchObject({
      formatVersion: '0.4', exportType: 'ban', format: 'raw', departments: ['33'],
    });
    expect(lines[1]).toEqual({
      type: 'district',
      nodeKey: 'DISTRICT:::11111111-1111-4111-8111-111111111111',
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        labels: [{ isoCode: 'fra', value: 'Bordeaux' }],
        status: 'active',
        updatedAt: '2026-01-15T00:00:00.000Z',
        integratedAt: null,
        meta: { insee: { cog: '33063' }, source: 'bal' },
      },
    });
    expect(lines[2].meta.note).toBe('stream-end');
    expect(Object.keys(lines[2].meta).sort()).toEqual(['generatedAt', 'note', 'stats']);
    expect(lines[2].meta.stats.district.count).toBe(1);
  });

  it('writes Standard FR metadata and payload names defined by v0.4', async () => {
    const result = await generateLocalExportFile(
      'export-token',
      'ban',
      {
        format: 'standard-fr',
        dataTypes: ['district'],
        departements: ['33'],
        address_ids: null,
        common_toponym_ids: null,
        district_ids: null,
        at: '2026-01-31T00:00:00.000Z',
      }
    );

    const lines = (await readFile(result.filePath, 'utf8'))
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));

    expect(lines[0].metadonnees).toMatchObject({
      versionFormat: '0.4', typeExport: 'ban', format: 'standard-fr', typesDonnees: ['commune'],
    });
    expect(lines[1]).toMatchObject({
      type: 'commune',
      donnees: { idCommune: '11111111-1111-4111-8111-111111111111', statut: 'active' },
    });
    expect(Object.keys(lines[2].metadonnees).sort()).toEqual(['genereLe', 'note', 'statistiques']);
    expect(lines[2].metadonnees.statistiques.commune.count).toBe(1);
  });
});
