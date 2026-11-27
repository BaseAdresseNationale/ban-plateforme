import ms from 'ms'

export const BAN_SESSION_HEADER = 'X-Ban-Session'

const DEFAULT_ABSOLUTE_DURATION = '12h'
const DEFAULT_IDLE_DURATION = '2h'
const DEFAULT_RETENTION_DURATION = '30d'

// Read at call time, not at module load, so tests can change them.
export const getProConnectProviderUrl = () => process.env.PROCONNECT_PROVIDER_URL

export const getProConnectClientId = () => process.env.PROCONNECT_CLIENT_ID

export const getSessionAbsoluteDurationMs = () => ms(process.env.BAN_SESSION_ABSOLUTE_DURATION || DEFAULT_ABSOLUTE_DURATION)

export const getSessionIdleDurationMs = () => ms(process.env.BAN_SESSION_IDLE_DURATION || DEFAULT_IDLE_DURATION)

export const getSessionRetentionDurationMs = () => ms(process.env.BAN_SESSION_RETENTION_DURATION || DEFAULT_RETENTION_DURATION)

export const isLegacySessionModeEnabled = () => process.env.BAN_SESSION_LEGACY_MODE_ENABLED === 'true'
