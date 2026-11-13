import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataExportRequestMessage } from './export/types.js';

const mocks = vi.hoisted(() => ({
  generateExport: vi.fn(), markExportError: vi.fn(), markExportProcessing: vi.fn(), markExportSuccess: vi.fn(),
}));
vi.mock('@ban/tools', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock('./export/generate.js', () => ({ generateExport: mocks.generateExport }));
vi.mock('./export/status.js', () => ({
  markExportError: mocks.markExportError, markExportProcessing: mocks.markExportProcessing, markExportSuccess: mocks.markExportSuccess,
}));
const { handleExportRequest } = await import('./handleExportRequest.js');
const message = { token: 'job', exportType: 'diff', params: {
  dataTypes: ['address'], departements: ['31'], address_ids: null, common_toponym_ids: null, district_ids: null,
  from: '2026-06-01T00:00:00+02:00', to: '2026-06-08T00:00:00+02:00',
} } satisfies DataExportRequestMessage;

describe('handleExportRequest', () => {
  beforeEach(() => { Object.values(mocks).forEach(mock => mock.mockReset()); });

  it.each(['local', 's3', 'both'])('publishes success only after the %s destinations finish', async storage => {
    const broker = { publish: vi.fn().mockResolvedValue(undefined) } as any;
    const result = { stats: { count: 2, params: message.params }, output: { storage, size: 123, sha256: 'hash' } };
    mocks.generateExport.mockResolvedValue(result);
    await handleExportRequest(broker, message);
    expect(mocks.markExportProcessing).toHaveBeenCalledWith('job');
    expect(mocks.generateExport).toHaveBeenCalledWith('job', 'diff', message.params);
    expect(mocks.markExportSuccess).toHaveBeenCalledWith('job', { ...result.stats, output: result.output }, 2);
    expect(broker.publish).toHaveBeenCalledWith('export.completed', {
      token: 'job', exportType: 'diff', status: 'success', report: { ...result.stats, output: result.output },
    });
    expect(mocks.markExportError).not.toHaveBeenCalled();
  });

  it('does not mark success while storage is still pending', async () => {
    let complete!: (value: unknown) => void;
    mocks.generateExport.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const broker = { publish: vi.fn() } as any;
    const processing = handleExportRequest(broker, message);
    await vi.waitFor(() => expect(mocks.generateExport).toHaveBeenCalledOnce());
    expect(mocks.markExportSuccess).not.toHaveBeenCalled();
    expect(broker.publish).not.toHaveBeenCalled();
    complete({ stats: { count: 0 }, output: { storage: 's3' } });
    await processing;
    expect(mocks.markExportSuccess).toHaveBeenCalledOnce();
  });

  it('reports a generation or destination failure without publishing success', async () => {
    const error = new Error('destination failed');
    mocks.generateExport.mockRejectedValue(error);
    const broker = { publish: vi.fn() } as any;
    await expect(handleExportRequest(broker, message)).rejects.toThrow(error);
    expect(mocks.markExportSuccess).not.toHaveBeenCalled();
    expect(mocks.markExportError).toHaveBeenCalledWith('job', error, { exportType: 'diff', params: message.params });
    expect(broker.publish).toHaveBeenCalledExactlyOnceWith('export.failed', {
      token: 'job', exportType: 'diff', status: 'error', error: 'destination failed',
    });
  });
});
