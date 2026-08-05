import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks
// -----
// Le suivi d'export est une lecture PostgreSQL simple. On mocke donc pgPool
// pour tester le contrat SQL et le mapping de la ligne job_status vers l'API.
const mocks = vi.hoisted(() => ({
  pgQuery: vi.fn(),
}));

vi.mock('@ban/api', () => ({
  pgPool: {
    query: mocks.pgQuery,
  },
}));

const { getDataExportStatus } = await import('./status.js');

// Fixtures
// --------
const createdAt = new Date('2026-01-31T12:00:00.000Z');
const updatedAt = new Date('2026-01-31T12:05:00.000Z');

// Tests
// -----
describe('getDataExportStatus', () => {
  beforeEach(() => {
    mocks.pgQuery.mockReset();
  });

  it('returns the export status mapped from ban.job_status', async () => {
    mocks.pgQuery.mockResolvedValue({
      rows: [{
        id: 'export-token',
        status: 'success',
        jobType: 'ban',
        count: 42,
        message: 'Export file generated',
        report: {
          output: {
            storage: 's3',
            bucket: 'ban-exports',
            key: 'exports/ban/export-token/export-token.ban.raw.ndjson',
          },
        },
        createdAt,
        updatedAt,
      }],
    });

    await expect(getDataExportStatus('export-token')).resolves.toEqual({
      token: 'export-token',
      status: 'success',
      exportType: 'ban',
      count: 42,
      message: 'Export file generated',
      report: {
        output: {
          storage: 's3',
          bucket: 'ban-exports',
          key: 'exports/ban/export-token/export-token.ban.raw.ndjson',
        },
      },
      createdAt,
      updatedAt,
    });

    expect(mocks.pgQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM ban.job_status'),
      ['export-token', 'export']
    );
  });

  it('returns null when the export token does not exist', async () => {
    mocks.pgQuery.mockResolvedValue({ rows: [] });

    await expect(getDataExportStatus('missing-token')).resolves.toBeNull();
  });
});
