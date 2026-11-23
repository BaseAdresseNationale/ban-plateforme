import { describe, expect, it } from 'vitest'

import { loadPostalConfig } from './config.js'

const configuration = {
  PG_URL: 'postgresql://fake:fake@postgres.invalid:1/ban_postal_unit',
  POSTAL_CODE_ADMIN_TOKEN: 'f'.repeat(36),
}

describe('postal startup configuration', () => {
  it('requires a database and tokens, with loopback and a free port by default', () => {
    expect(loadPostalConfig(configuration)).toEqual({
      tokens: ['f'.repeat(36)], host: '127.0.0.1', port: 0, adminEnabled: false,
    })
    expect(loadPostalConfig({ ...configuration, POSTAL_CODE_PORT: '8124' }).port).toBe(8124)
  })

  it('only enables administration explicitly and rejects ambiguous flags', () => {
    expect(loadPostalConfig({ ...configuration, POSTAL_CODE_ADMIN_ENABLED: 'true' })
      .adminEnabled).toBe(true)
    for (const value of ['', '1', 'yes', 'TRUE']) {
      expect(() => loadPostalConfig({ ...configuration, POSTAL_CODE_ADMIN_ENABLED: value }))
        .toThrow('POSTAL_CODE_ADMIN_ENABLED')
    }
  })

  it.each([undefined, '', 'invalid', 'https://example.invalid/database', 'postgresql://host']) (
    'rejects missing or invalid database URLs without exposing the input %#', PG_URL => {
      expect(() => loadPostalConfig({ ...configuration, PG_URL }))
        .toThrow('A valid PostgreSQL PG_URL is required')
    },
  )

  it('rejects missing credentials before opening a listener', () => {
    expect(() => loadPostalConfig({ PG_URL: configuration.PG_URL }))
      .toThrow('POSTAL_CODE_ADMIN_TOKEN')
  })

  it.each(['-1', '65536', '1.5', '', 'NaN'])(
    'rejects invalid ports %#', POSTAL_CODE_PORT => {
      expect(() => loadPostalConfig({ ...configuration, POSTAL_CODE_PORT }))
        .toThrow('POSTAL_CODE_PORT')
    },
  )

  it('rejects arbitrary hostnames and preserves explicitly configured bind addresses', () => {
    expect(() => loadPostalConfig({ ...configuration, POSTAL_CODE_HOST: 'example.invalid' }))
      .toThrow('POSTAL_CODE_HOST')
    expect(loadPostalConfig({ ...configuration, POSTAL_CODE_HOST: '::1' }).host).toBe('::1')
  })
})
