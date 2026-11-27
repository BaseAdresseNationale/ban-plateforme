import {createHash, randomBytes} from 'node:crypto'
import {Op} from 'sequelize'
import {v4 as uuidv4} from 'uuid'
import {Session} from '../../util/sequelize.js'
import {getSessionAbsoluteDurationMs, getSessionIdleDurationMs, getSessionRetentionDurationMs} from './config.js'

// 32 random bytes in base64url, without padding.
const SESSION_ID_PATTERN = /^[\w-]{43}$/

export const hashSessionId = sessionId => createHash('sha256').update(sessionId).digest('hex')

const isWellFormedSessionId = sessionId => typeof sessionId === 'string' && SESSION_ID_PATTERN.test(sessionId)

// Only the hash of the session id is stored: a database leak does not hand out usable sessions.
export const createVerifiedSession = async identity => {
  const sessionId = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + getSessionAbsoluteDurationMs())

  await Session.create({
    id: uuidv4(),
    ...identity,
    tokenHash: hashSessionId(sessionId),
    expiresAt,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  })

  return {sessionId, expiresAt}
}

// Lookup, expiry check, idle check and touch in one statement, so two concurrent requests cannot revive an idle session.
export const findActiveSession = async sessionId => {
  if (!isWellFormedSessionId(sessionId)) {
    return null
  }

  const now = new Date()
  const [, rows] = await Session.update({lastSeenAt: now}, {
    where: {
      tokenHash: hashSessionId(sessionId),
      expiresAt: {[Op.gt]: now},
      lastSeenAt: {[Op.gt]: new Date(now.getTime() - getSessionIdleDurationMs())},
    },
    returning: true,
  })

  return rows[0] ?? null
}

// The row is kept until the purge so that ban.action keeps its link for the retention period.
export const revokeSession = async sessionId => {
  if (!isWellFormedSessionId(sessionId)) {
    return
  }

  const now = new Date()
  await Session.update({expiresAt: now}, {
    where: {tokenHash: hashSessionId(sessionId), expiresAt: {[Op.gt]: now}},
  })
}

export const purgeExpiredSessions = now => Session.destroy({
  where: {expiresAt: {[Op.lt]: new Date(now.getTime() - getSessionRetentionDurationMs())}},
})

// Legacy mode (claims sent by the site, unverified): tokenHash null keeps both families apart.
export const addSession = async session => {
  const now = new Date()
  const [, created] = await Session.findOrCreate({
    where: {...session, tokenHash: null},
    defaults: {
      id: uuidv4(),
      ...session,
      expiresAt: new Date(now.getTime() + getSessionAbsoluteDurationMs()),
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now
    }
  })

  return created
}

export const getSession = async session => {
  const resultSession = await Session.findOne({
    where: {...session, tokenHash: null},
    order: [['createdAt', 'DESC']]
  })
  return resultSession
}
