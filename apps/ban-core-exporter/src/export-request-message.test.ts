import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleExportRequest: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('@ban/tools', () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
  },
}));

vi.mock('./handleExportRequest.js', () => ({
  handleExportRequest: mocks.handleExportRequest,
}));

const { handleExportRequestedMessage } = await import('./export-request-message.js');

describe('handleExportRequestedMessage', () => {
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
