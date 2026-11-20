import { parsePostalTokens } from './auth.js'

export function loadPostalConfig(env: NodeJS.ProcessEnv) {
  try {
    const database = new URL(env.PG_URL ?? '')
    if (!['postgres:', 'postgresql:'].includes(database.protocol)
      || !database.hostname || database.pathname.length < 2) {
      throw new Error('Invalid database destination')
    }
  } catch {
    throw new Error('A valid PostgreSQL PG_URL is required')
  }
  const tokens = parsePostalTokens(env.POSTAL_CODE_ADMIN_TOKEN)
  const rawPort = env.POSTAL_CODE_PORT ?? '0'
  if (!/^\d+$/.test(rawPort) || Number(rawPort) > 65535) {
    throw new Error('POSTAL_CODE_PORT must be an integer between 0 and 65535')
  }
  const host = env.POSTAL_CODE_HOST ?? '127.0.0.1'
  if (!['127.0.0.1', '::1', '0.0.0.0'].includes(host)) {
    throw new Error('Invalid POSTAL_CODE_HOST')
  }
  return { tokens, port: Number(rawPort), host }
}
