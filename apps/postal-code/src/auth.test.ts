import { describe, expect, it } from 'vitest'

import { isPostalAuthorized, parsePostalTokens } from './auth.js'

const token = 'f'.repeat(36)

describe('postal token authentication', () => {
  it('preserves the Token scheme and configured list with deterministic comparison', () => {
    const tokens = parsePostalTokens(` ${token},${'g'.repeat(36)},${token} `)
    expect(tokens).toEqual([token, 'g'.repeat(36)])
    expect(isPostalAuthorized(`Token ${token}`, tokens)).toBe(true)
    expect(isPostalAuthorized(`tOkEn ${token}`, tokens)).toBe(true)
  })

  it.each([
    undefined, '', 'Bearer token', 'Token', 'Token short',
    `Token ${'h'.repeat(36)}`, `Token ${token}\n`,
  ])(
    'rejects missing or invalid credentials %#', authorization => {
      expect(isPostalAuthorized(authorization, [token])).toBe(false)
    },
  )

  it('fails closed when no token is configured', () => {
    expect(isPostalAuthorized(`Token ${token}`, [])).toBe(false)
  })

  it.each([undefined, '', 'short', `${token},`, 'a '.repeat(18)])(
    'rejects incomplete configuration %#', value => {
      expect(() => parsePostalTokens(value)).toThrow('POSTAL_CODE_ADMIN_TOKEN')
    },
  )
})
