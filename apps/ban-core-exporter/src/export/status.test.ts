import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('@ban/prisma-client', () => ({
  pool: {
    query: mocks.query,
  },
}));

const {
  markExportError,
  markExportProcessing,
  markExportSuccess,
} = await import('./status.js');

describe('export status transitions', () => {
  beforeEach(() => {
    mocks.query.mockReset();
  });

  it('limits all status updates to export jobs', async () => {
    await markExportProcessing('export-token');
    await markExportSuccess('export-token', { output: {} }, 1);
    await markExportError('export-token', new Error('generation failed'));

    for (const [query] of mocks.query.mock.calls) {
      expect(query).toContain('WHERE id = $1');
      expect(query).toContain('AND "dataType" = \'export\'');
    }
  });
});
