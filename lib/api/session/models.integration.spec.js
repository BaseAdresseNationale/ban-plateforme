import {Action, Session} from '../../util/sequelize.js'
import {addAction} from '../action/models.js'
import {
  connectStores,
  insertDistrictFixtures,
  purgeFixtures,
  tearDown,
  TEST_DISTRICT_ID,
  TEST_COMMUNE_SIREN,
  COMMUNE_SIRET,
} from '../__integration__/helpers.js'
import {createVerifiedSession, hashSessionId, purgeExpiredSessions, revokeSession} from './models.js'

const DAY_MS = 24 * 60 * 60 * 1000
const PURGE_SUB = 'integration-test-sub-purge'

const createSession = async () => {
  const now = Math.floor(Date.now() / 1000)
  const {sessionId} = await createVerifiedSession({
    sub: PURGE_SUB,
    email: `${PURGE_SUB}@example.test`,
    siret: COMMUNE_SIRET,
    aud: 'integration-test-client',
    exp: now + 60,
    iat: now,
    iss: 'https://proconnect.example.test',
  })
  return Session.findOne({where: {tokenHash: hashSessionId(sessionId)}}).then(row => ({sessionId, row}))
}

const createSessionExpiredDaysAgo = async days => {
  const {row} = await createSession()
  await row.update({expiresAt: new Date(Date.now() - (days * DAY_MS))})
  return row
}

beforeAll(async () => {
  await connectStores()
  await purgeFixtures()
  await insertDistrictFixtures()
})

afterAll(tearDown)

describe('purgeExpiredSessions', () => {
  test('deletes only sessions expired for more than the retention, and keeps the actions made with them', async () => {
    const expiredLongAgo = await createSessionExpiredDaysAgo(31)
    const expiredRecently = await createSessionExpiredDaysAgo(29)
    const {row: active} = await createSession()
    const action = await addAction({districtID: TEST_DISTRICT_ID, status: true, label: 'district-config-updated', siren: TEST_COMMUNE_SIREN, sessionID: expiredLongAgo.id})

    await purgeExpiredSessions(new Date())

    expect(await Session.findByPk(expiredLongAgo.id)).toBeNull()
    expect(await Session.findByPk(expiredRecently.id)).not.toBeNull()
    expect(await Session.findByPk(active.id)).not.toBeNull()

    const keptAction = await Action.findByPk(action.id)
    expect(keptAction.siren).toBe(TEST_COMMUNE_SIREN)
    expect(keptAction.sessionID).toBeNull()
  })

  test('a revoked session is kept until its retention ends', async () => {
    const {sessionId, row} = await createSession()
    const revokedAt = Date.now()

    await revokeSession(sessionId)
    await purgeExpiredSessions(new Date())

    // The retention counts from the revocation, which sets expiresAt to now.
    const revoked = await Session.findByPk(row.id)
    expect(revoked).not.toBeNull()
    expect(revoked.expiresAt.getTime()).toBeGreaterThanOrEqual(revokedAt)
    expect(revoked.expiresAt.getTime()).toBeLessThanOrEqual(Date.now())
  })
})
