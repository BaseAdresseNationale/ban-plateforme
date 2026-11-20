import { timingSafeEqual } from 'node:crypto'

export function parsePostalTokens(value: string | undefined): string[] {
  const tokens = value?.split(',').map(token => token.trim()) ?? []
  if (tokens.length === 0 || tokens.some(token => token.length !== 36 || /\s/.test(token))) {
    throw new Error('POSTAL_CODE_ADMIN_TOKEN must contain nonempty 36-character tokens')
  }
  return [...new Set(tokens)]
}

export function isPostalAuthorized(authorization: string | undefined, tokens: readonly string[]) {
  const match = /^Token ([^\s]+)$/i.exec(authorization ?? '')
  if (!match || match[0] !== authorization || match[1].length !== 36) return false
  const supplied = Buffer.from(match[1])
  return tokens.some(token => {
    const expected = Buffer.from(token)
    return expected.length === supplied.length && timingSafeEqual(expected, supplied)
  })
}
