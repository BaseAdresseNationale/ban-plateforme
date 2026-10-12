import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  loggerInfo: vi.fn(),
  empty: false,
  schemaError: false,
  labelError: false,
}));

vi.mock('@ban/prisma-client', () => ({
  pool: {
    connect: mocks.connect,
  },
}));

vi.mock('@ban/tools', async importOriginal => ({
  ...await importOriginal<typeof import('@ban/tools')>(),
  logger: {
    info: mocks.loggerInfo,
  },
}));

vi.mock('pg-cursor', () => ({
  default: class FakeCursor {
    rows: Record<string, unknown>[];

    constructor(public request: string, public params: unknown[]) {
      if (mocks.schemaError) throw new Error('function ban.snapshot_district_ndjson does not exist');
      const district = {
        id: '11111111-1111-4111-8111-111111111111',
        labels: [{ isoCode: 'fra', value: 'Bordeaux' }],
        updateDate: '2026-01-15T00:00:00.000Z',
        meta: { insee: { cog: '33063' }, source: 'bal' },
      };
      if (mocks.labelError) district.labels = [{ isoCode: 'fra', value: '' }];
      const isDiff = request.includes('diff_district_ndjson');
      this.rows = [
        {
          [isDiff ? 'diff_district_ndjson' : 'snapshot_district_ndjson']: JSON.stringify(isDiff ? {
            event: 'updated', type: 'district', nodeKey: `DISTRICT:::${district.id}`,
            datas: [{ ...district, integratedAt: '2026-01-16T00:00:00.000Z' }, district],
          } : {
            type: 'district', nodeKey: `DISTRICT:::${district.id}`, data: district,
          }),
        },
      ];
      if (mocks.empty) this.rows = [];
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
const { getExportOutputDir } = await import('./output-directory.js');

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
    mocks.empty = false;
    mocks.schemaError = false;
    mocks.labelError = false;
    mocks.connect.mockResolvedValue({
      query: vi.fn(cursor => cursor),
      release,
    });
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('rejects invalid selections before connecting or creating an output file', async () => {
    await expect(generateLocalExportFile('invalid', 'ban', {
      dataTypes: ['unknown'], departements: ['31'], at: '2026-06-01',
      address_ids: null, common_toponym_ids: null, district_ids: null,
    })).rejects.toThrow('Invalid dataTypes');
    expect(mocks.connect).not.toHaveBeenCalled();
    await expect(readFile(getExportOutputDir(), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  for (const type of ['ban','diff'] as const) {
    it(`writes a valid empty ${type} stream with all selected zero counters`, async () => {
      mocks.empty = true;
      const result = await generateLocalExportFile('empty', type, {
        dataTypes: ['district','toponym','address'], departements: ['99'],
        address_ids: null, common_toponym_ids: null, district_ids: null,
        ...(type === 'ban' ? { at: '2026-01-01T00:00:00Z' } : { from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' }),
      });
      const lines = (await readFile(result.filePath,'utf8')).trim().split('\n').map(line => JSON.parse(line));

      expect(lines).toHaveLength(2);
      expect(lines[0]['meta'].note).toBe('stream-start');
      const end = lines[1]['meta'];
      expect(end.note).toBe('stream-end');
      const counters = type === 'ban' ? { count: 0 } : { count: 0, created: 0, updated: 0, disabled: 0 };
      expect(end['stats']).toEqual(Object.fromEntries(
        (['district','toponym','address']).map(t => [t,counters])));
      expect(result.stats.count).toBe(0); expect(release).toHaveBeenCalledOnce();
    });
    it(`rejects a missing structure for ${type}, not a successful empty export`, async () => {
      mocks.schemaError = true;
      await expect(generateLocalExportFile('missing',type,{ dataTypes: ['district'], departements: ['99'],
        address_ids: null, common_toponym_ids: null, district_ids: null,
        ...(type === 'ban' ? { at: '2026-01-01T00:00:00Z' } : { from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' }),
      })).rejects.toThrow('does not exist');
      expect(release).toHaveBeenCalledOnce();
    });
  }

  it('preserves a formatter failure, closes pending file writes and can export afterwards', async () => {
    mocks.labelError = true;
    const params = { dataTypes: ['district'], departements: ['96'], at: '2026-01-01T00:00:00Z',
      address_ids: null, common_toponym_ids: null, district_ids: null };
    await expect(generateLocalExportFile('bad-label','ban',params)).rejects.toThrow('No populated label');
    const failed = await readFile(path.join(getExportOutputDir(),'ban--dep-96--2026-01-01T01-00-00+0100--bad-label.ban-standard.ndjson'),'utf8');
    expect(failed).not.toContain('stream-end');
    mocks.labelError = false;
    const next = await generateLocalExportFile('good-label','ban',params);
    expect(next.stats.count).toBe(1); expect(release).toHaveBeenCalledTimes(2);
  });

  it('writes a local NDJSON export file with metadata, data and stats', async () => {
    const result = await generateLocalExportFile(
      'export-token',
      'full',
      {

        dataTypes: ['district'],
        departements: ['33'],
        address_ids: null,
        common_toponym_ids: null,
        district_ids: null,
        at: '2026-01-31T00:00:00.000Z',
      }
    );

    expect(path.basename(result.filePath)).toBe('full--dep-33--2026-01-31T01-00-00+0100--export-token.ban-standard.ndjson');
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
      formatVersion: '0.4', exportType: 'full', format: 'ban-standard', request: { departments: ['33'] },
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

  it('writes ordered ban-standard DIFF events instead of only their statistics', async () => {
    const result = await generateLocalExportFile(
      'export-token',
      'diff',
      {

        dataTypes: ['district'],
        departements: ['33'],
        address_ids: null,
        common_toponym_ids: null,
        district_ids: null,
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-02-01T00:00:00.000Z',
      }
    );

    const lines = (await readFile(result.filePath, 'utf8'))
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));

    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatchObject({ event: 'updated', type: 'district' });
    expect(lines[1].data).toHaveLength(2);
    expect(lines[1].data[0]).toMatchObject({ id: '11111111-1111-4111-8111-111111111111' });
    expect(lines[2].meta.stats.district).toEqual({ count: 1, created: 0, updated: 1, disabled: 0 });
  });
});
