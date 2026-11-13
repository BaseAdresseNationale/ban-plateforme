import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pgQuery: vi.fn(),
  publishRabbitMqMessage: vi.fn(),
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'export-token',
}));

vi.mock('@ban/api', () => ({
  pgPool: {
    query: mocks.pgQuery,
  },
}));

vi.mock('../../../rabbitmq.config.js', () => ({
  publications: {
    exportRequested: 'exportRequested',
  },
}));

vi.mock('../../../rabbitmq.broker.js', () => ({
  publishRabbitMqMessage: mocks.publishRabbitMqMessage,
}));

const { enqueueDataExportRequest } = await import('./enqueue.js');

const params = {

  dataTypes: ['district', 'toponym', 'address'],
  departements: ['33'],
  address_ids: null,
  common_toponym_ids: null,
  district_ids: null,
  from: '2026-01-01T00:00:00.000Z',
  to: '2026-01-31T00:00:00.000Z',
};

describe('enqueueDataExportRequest', () => {
  it('rejects oversized internal selections before status insertion or publishing', async () => {
    mocks.pgQuery.mockClear(); mocks.publishRabbitMqMessage.mockClear();
    await expect(enqueueDataExportRequest('diff', { ...params, address_ids: Array(1001).fill('11111111-1111-4111-8111-111111111111') })).rejects.toThrow('1000');
    expect(mocks.pgQuery).not.toHaveBeenCalled();
    expect(mocks.publishRabbitMqMessage).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    mocks.pgQuery.mockReset();
    mocks.publishRabbitMqMessage.mockReset();
    mocks.pgQuery.mockResolvedValue({ rows: [] });
    mocks.publishRabbitMqMessage.mockResolvedValue(undefined);
  });

  it.each(['full', 'diff'] as const)('creates a pending %s status and publishes the export request', async exportType => {
    const { from, to, ...selection } = params;
    const requestParams = exportType === 'full' ? { ...selection, at: to } : { ...selection, from, to };
    const result = await enqueueDataExportRequest(exportType, requestParams);

    expect(result).toEqual({
      token: 'export-token',
      exportType,
      status: 'pending',
    });

    expect(mocks.pgQuery).toHaveBeenCalledTimes(1);
    expect(mocks.pgQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ban.job_status'),
      [
        'export-token',
        'pending',
        'export',
        exportType,
        'Export request accepted',
        JSON.stringify({ params: requestParams }),
        expect.any(Date),
        expect.any(Date),
      ]
    );
    expect(mocks.publishRabbitMqMessage).toHaveBeenCalledWith(
      'exportRequested',
      {
        token: 'export-token',
        exportType,
        params: requestParams,
      }
    );
  });

  it('marks the export status as error when RabbitMQ publication fails', async () => {
    const error = new Error('RabbitMQ unavailable');
    mocks.publishRabbitMqMessage.mockRejectedValue(error);

    await expect(enqueueDataExportRequest('diff', params)).rejects.toThrow(error);

    expect(mocks.pgQuery).toHaveBeenCalledTimes(2);
    expect(mocks.pgQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE ban.job_status'),
      [
        'export-token',
        'error',
        'RabbitMQ unavailable',
        expect.any(Date),
      ]
    );
  });
});
