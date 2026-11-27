import request from 'supertest'
import {sequelize, Session} from '../../util/sequelize.js'
import {hashSessionId} from '../session/models.js'
import {
  buildApp,
  connectStores,
  useTestToken,
  useFakeProConnect,
  createTestSession,
  sessionHeader,
  withLegacyMode,
  buildSessionClaims,
  insertSession,
  insertDistrictFixtures,
  ensureExternalRows,
  deleteDistrictConfig,
  purgeFixtures,
  tearDown,
  TEST_DISTRICT_ID,
  TEST_COMMUNE_SIREN,
  COMMUNE_SESSION_SUB,
  COMMUNE_SIRET,
  OTHER_COMMUNE_SESSION_SUB,
  OTHER_COMMUNE_SIRET,
} from '../__integration__/helpers.js'

const app = buildApp()
const ISSUER_CONFIG = {certificateIssuerDetails: 'Mairie de test'}
const MINUTE_MS = 60 * 1000
let token
let communeSessionId
let otherCommuneSessionId

const enable = ({headers = {}, body = {}}) => request(app)
  .patch('/api/district/addressing-certification/enable')
  .set('Authorization', `Token ${token}`)
  .set(headers)
  .send({districtID: TEST_DISTRICT_ID, ...body})

const enableWithSession = ({sessionId, body = {config: ISSUER_CONFIG}}) => enable({headers: sessionHeader(sessionId), body})

const getDistrictConfig = async () => {
  const [rows] = await sequelize.query('SELECT config FROM ban.district_config WHERE district_id = :districtId', {replacements: {districtId: TEST_DISTRICT_ID}})
  return rows[0]?.config ?? null
}

const getActionSirens = async () => {
  const [rows] = await sequelize.query('SELECT siren FROM ban.action WHERE "districtID" = :districtId', {replacements: {districtId: TEST_DISTRICT_ID}})
  return rows.map(({siren}) => siren)
}

const deleteActions = () =>
  sequelize.query('DELETE FROM ban.action WHERE "districtID" = :districtId', {replacements: {districtId: TEST_DISTRICT_ID}})

const updateSessionRow = ({sessionId, values}) => Session.update(values, {where: {tokenHash: hashSessionId(sessionId)}})

const findSessionRow = sessionId => Session.findOne({where: {tokenHash: hashSessionId(sessionId)}})

beforeAll(async () => {
  await connectStores()
  await purgeFixtures()
  token = useTestToken()
  await useFakeProConnect()
  await ensureExternalRows()
  await insertDistrictFixtures()
  communeSessionId = await createTestSession({sub: COMMUNE_SESSION_SUB, siret: COMMUNE_SIRET})
  otherCommuneSessionId = await createTestSession({sub: OTHER_COMMUNE_SESSION_SUB, siret: OTHER_COMMUNE_SIRET})
})

// Each case starts without config, so no case ever updates it (see deleteDistrictConfig).
afterEach(async () => {
  await deleteDistrictConfig()
  await deleteActions()
})
afterAll(tearDown)

describe('PATCH /api/district/addressing-certification/enable with a session', () => {
  test('a session of another commune gets 403 and writes nothing', async () => {
    const response = await enableWithSession({sessionId: otherCommuneSessionId})

    expect(response.status).toBe(403)
    expect(await getDistrictConfig()).toBeNull()
    expect(await getActionSirens()).toEqual([])
  })

  test('an invalid certificateType gets 400 and writes nothing', async () => {
    const response = await enableWithSession({sessionId: communeSessionId, body: {certificateType: 'FOO'}})

    expect(response.status).toBe(400)
    expect(await getDistrictConfig()).toBeNull()
  })

  test('the commune session gets 200, the body siren is ignored and the commune SIREN is logged', async () => {
    const response = await enableWithSession({sessionId: communeSessionId, body: {siren: '123456789', config: ISSUER_CONFIG}})

    expect(response.status).toBe(200)
    expect(await getDistrictConfig()).toEqual(ISSUER_CONFIG)
    expect(await getActionSirens()).toEqual([TEST_COMMUNE_SIREN])
  })

  test('an unknown session id gets 401', async () => {
    const response = await enableWithSession({sessionId: 'A'.repeat(43)})

    expect(response.status).toBe(401)
    expect(await getDistrictConfig()).toBeNull()
  })

  test('an expired session gets 401', async () => {
    const sessionId = await createTestSession({sub: COMMUNE_SESSION_SUB, siret: COMMUNE_SIRET})
    await updateSessionRow({sessionId, values: {expiresAt: new Date(Date.now() - MINUTE_MS)}})

    const response = await enableWithSession({sessionId})

    expect(response.status).toBe(401)
    expect(await getDistrictConfig()).toBeNull()
  })

  test('a session idle for more than 2 h gets 401', async () => {
    const sessionId = await createTestSession({sub: COMMUNE_SESSION_SUB, siret: COMMUNE_SIRET})
    await updateSessionRow({sessionId, values: {lastSeenAt: new Date(Date.now() - (121 * MINUTE_MS))}})

    const response = await enableWithSession({sessionId})

    expect(response.status).toBe(401)
    expect(await getDistrictConfig()).toBeNull()
  })

  test('a session idle for less than 2 h gets 200 and its last activity moves forward', async () => {
    const sessionId = await createTestSession({sub: COMMUNE_SESSION_SUB, siret: COMMUNE_SIRET})
    const idleSince = new Date(Date.now() - (119 * MINUTE_MS))
    await updateSessionRow({sessionId, values: {lastSeenAt: idleSince}})

    const response = await enableWithSession({sessionId})

    expect(response.status).toBe(200)
    expect((await findSessionRow(sessionId)).lastSeenAt.getTime()).toBeGreaterThan(idleSince.getTime() + MINUTE_MS)
  })

  test('a revoked session gets 401', async () => {
    const sessionId = await createTestSession({sub: COMMUNE_SESSION_SUB, siret: COMMUNE_SIRET})
    await request(app).delete('/api/session').set('Authorization', `Token ${token}`).set(sessionHeader(sessionId))

    const response = await enableWithSession({sessionId})

    expect(response.status).toBe(401)
    expect(await getDistrictConfig()).toBeNull()
  })
})

describe('PATCH /api/district/addressing-certification/enable in the old mode', () => {
  const communeClaims = buildSessionClaims({sub: COMMUNE_SESSION_SUB, siret: COMMUNE_SIRET})

  beforeAll(() => insertSession(communeClaims))

  test('claims without the session header get 401 when the old mode is off', async () => {
    const response = await enable({body: {...communeClaims, config: ISSUER_CONFIG}})

    expect(response.status).toBe(401)
    expect(await getDistrictConfig()).toBeNull()
  })

  test('claims without the session header get 200 when the old mode is on', async () => {
    const response = await withLegacyMode(() => enable({body: {...communeClaims, config: ISSUER_CONFIG}}))

    expect(response.status).toBe(200)
    expect(await getDistrictConfig()).toEqual(ISSUER_CONFIG)
  })

  test('an invalid session header gets 401 even when the old mode is on', async () => {
    const response = await withLegacyMode(() => enable({headers: sessionHeader('A'.repeat(43)), body: {...communeClaims, config: ISSUER_CONFIG}}))

    expect(response.status).toBe(401)
    expect(await getDistrictConfig()).toBeNull()
  })
})
