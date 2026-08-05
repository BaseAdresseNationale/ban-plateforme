import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks
// -----
// Ce fichier teste le handler Express. La lecture PostgreSQL est testee dans
// data/exports/status.test.ts, donc on mocke getDataExportStatus pour verifier
// uniquement le mapping route : statut HTTP, message et body JSON.
const mocks = vi.hoisted(() => ({
  getDataExportStatus: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@ban/tools', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock('../data/exports/status.js', () => ({
  getDataExportStatus: mocks.getDataExportStatus,
}));

const { getExportReportRouteHandler } = await import('./exports.js');

// Fixtures et preparation
// -----------------------
const createResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);

  return res;
};

// Tests
// -----
describe('export report route', () => {
  beforeEach(() => {
    mocks.getDataExportStatus.mockReset();
    mocks.loggerError.mockReset();
  });

  it('returns the export report for a known token', async () => {
    mocks.getDataExportStatus.mockResolvedValue({
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
      createdAt: new Date('2026-01-31T12:00:00.000Z'),
      updatedAt: new Date('2026-01-31T12:05:00.000Z'),
    });
    const req = {
      params: {
        token: 'export-token',
      },
    };
    const res = createResponse();

    await getExportReportRouteHandler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      message: 'Export report',
      response: expect.objectContaining({
        token: 'export-token',
        status: 'success',
        exportType: 'ban',
        count: 42,
        message: 'Export file generated',
      }),
    }));
    expect(mocks.getDataExportStatus).toHaveBeenCalledWith('export-token');
  });

  it('returns 404 for an unknown token', async () => {
    mocks.getDataExportStatus.mockResolvedValue(null);
    const req = {
      params: {
        token: 'missing-token',
      },
    };
    const res = createResponse();

    await getExportReportRouteHandler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: 'Export report not found',
      response: {},
    }));
  });
});
