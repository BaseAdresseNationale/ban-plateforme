import { afterEach, describe, expect, it, vi } from 'vitest';

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  vi.resetModules();
});

describe('rawToBan', () => {
  it('keeps the test-only region unavailable in development', async () => {
    process.env.NODE_ENV = 'development';
    const { rawToBan } = await import('./formatters.js');

    const district = rawToBan.district!(
      { type: 'district', nodekey: 'district-1' },
      {
        id: 'district-1',
        meta: {
          insee: { cog: '96000' },
        },
      }
    );

    expect(district.meta.ban.region).toBeNull();
  });

  it('exposes the test-only region in the test environment', async () => {
    process.env.NODE_ENV = 'test';
    const { rawToBan } = await import('./formatters.js');

    const district = rawToBan.district!(
      { type: 'district', nodekey: 'district-1' },
      {
        id: 'district-1',
        meta: {
          insee: { cog: '96000' },
        },
      }
    );

    expect(district.meta.ban.region).toEqual({
      code: '96',
      nom: 'Royaumes-Enchantes',
    });
  });
});
