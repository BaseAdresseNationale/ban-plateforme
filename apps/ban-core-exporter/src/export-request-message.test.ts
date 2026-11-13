import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleExportRequest: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  markExportError: vi.fn(),
}));

vi.mock('@ban/tools', async importOriginal => ({
  ...await importOriginal<typeof import('@ban/tools')>(),
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
  },
}));

vi.mock('./handleExportRequest.js', () => ({
  handleExportRequest: mocks.handleExportRequest,
}));
vi.mock('./export/status.js', () => ({ markExportError: mocks.markExportError }));

const { handleExportRequestedMessage } = await import('./export-request-message.js');

describe('handleExportRequestedMessage', () => {
  it.each(['full', 'diff'] as const)('processes and acknowledges a valid %s request', async exportType => {
    const broker = {} as any;
    const ack = vi.fn();
    const selection = { departements: ['96'], dataTypes: ['address'] };
    const dates = exportType === 'full'
      ? { at: '2026-05-11T00:00:00.000Z' }
      : { from: '2026-05-04T00:00:00.000Z', to: '2026-05-11T00:00:00.000Z' };

    await handleExportRequestedMessage(broker, {
      token: 'test', exportType, params: { ...selection, ...dates },
    }, ack);

    expect(mocks.handleExportRequest).toHaveBeenCalledWith(broker, {
      token: 'test', exportType,
      params: { ...selection, ...dates, address_ids: null, common_toponym_ids: null, district_ids: null },
    });
    expect(mocks.markExportError).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith();
  });

  it('rejects an unknown request parameter before handling the job', async () => {
    const ack = vi.fn();
    await handleExportRequestedMessage({} as any, {
      token: 'test', exportType: 'full', params: {
        unexpected: true, departements: ['96'], dataTypes: ['address'], at: '2026-05-04',
      },
    }, ack);
    expect(mocks.handleExportRequest).not.toHaveBeenCalled();
    expect(mocks.markExportError).toHaveBeenCalledWith('test', expect.any(Error));
    expect(ack).toHaveBeenCalledWith();
  });

  it('rejects oversized selections before processing and does not requeue', async () => {
    const ack = vi.fn();
    await handleExportRequestedMessage({} as any, {
      token: 'test', exportType: 'full', params: {
        departements: ['96'], dataTypes: ['address'],
        address_ids: Array(1001).fill('11111111-1111-4111-8111-111111111111'),
      },
    }, ack);
    expect(mocks.handleExportRequest).not.toHaveBeenCalled();
    expect(mocks.markExportError).toHaveBeenCalledWith('test', expect.any(Error));
    expect(ack).toHaveBeenCalledWith();
  });
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
  });

  it('acknowledges invalid messages without requeuing them', async () => {
    const ackOrNack = vi.fn();
    const invalidMessage = { token: 'export-token', exportType: 'invalid' };

    await handleExportRequestedMessage({} as any, invalidMessage, ackOrNack);

    expect(mocks.loggerError).toHaveBeenCalledWith(
      '[ban-core-exporter] Message invalide:',
      invalidMessage
    );
    expect(mocks.handleExportRequest).not.toHaveBeenCalled();
    expect(ackOrNack).toHaveBeenCalledWith();
  });
});
