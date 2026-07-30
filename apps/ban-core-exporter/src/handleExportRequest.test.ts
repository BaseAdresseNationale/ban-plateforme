import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataExportRequestMessage } from './export/types.js';

const mocks = vi.hoisted(() => ({
  generateLocalExportFile: vi.fn(),
  markExportError: vi.fn(),
  markExportProcessing: vi.fn(),
  markExportSuccess: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('@ban/tools', () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
  },
}));

vi.mock('./export/generate.js', () => ({
  generateLocalExportFile: mocks.generateLocalExportFile,
}));

vi.mock('./export/status.js', () => ({
  markExportError: mocks.markExportError,
  markExportProcessing: mocks.markExportProcessing,
  markExportSuccess: mocks.markExportSuccess,
}));

const { handleExportRequest } = await import('./handleExportRequest.js');

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

describe('handleExportRequest', () => {
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
  });

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
    expect(mocks.markExportSuccess).toHaveBeenCalledWith(
      'export-token',
      {
        count: 2,
        output: {
          storage: 'local',
          path: '/tmp/export.ndjson',
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
          storage: 'local',
          path: '/tmp/export.ndjson',
        },
      },
    });
  });

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
