import {createHash, randomBytes} from 'node:crypto'
import request from 'supertest'
import {Session} from '../../util/sequelize.js'
import {
  buildApp,
  connectStores,
  useTestToken,
  useFakeProConnect,
  sessionHeader,
  withLegacyMode,
  buildSessionClaims,
  purgeFixtures,
  tearDown,
  SESSION_ROUTE_SUB,
  COMMUNE_SIRET,
} from '../__integration__/helpers.js'
import {invalidTokenCases} from '../__integration__/fake-proconnect.js'

const app = buildApp()
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000
let token
let provider

const postSession = body => request(app)
  .post('/api/session')
  .set('Authorization', `Token ${token}`)
  .send(body)

const deleteSession = headers => request(app)
  .delete('/api/session')
  .set('Authorization', `Token ${token}`)
  .set(headers)

const listFavorites = sessionId => request(app)
  .post('/api/user-preferences/favorites/list')
  .set('Authorization', `Token ${token}`)
  .set(sessionHeader(sessionId))
  .send({})

const login = async () => postSession(await provider.createTokens({sub: SESSION_ROUTE_SUB, siret: COMMUNE_SIRET}))

const countSessions = () => Session.count({where: {sub: SESSION_ROUTE_SUB}})

beforeAll(async () => {
  await connectStores()
  await purgeFixtures()
  token = useTestToken()
  provider = await useFakeProConnect()
})

beforeEach(() => Session.destroy({where: {sub: SESSION_ROUTE_SUB}}))

afterAll(tearDown)

describe('POST /api/session with ProConnect tokens', () => {
  test('valid tokens get 201 with an opaque session id, only its hash is stored', async () => {
    const before = Date.now()
    const response = await login()

    expect(response.status).toBe(201)
    const {sessionId, expiresAt} = response.body.response
    expect(sessionId).toMatch(/^[\w-]{43}$/)
    expect(new Date(expiresAt).getTime()).toBeGreaterThanOrEqual(before + TWELVE_HOURS_MS)
    expect(new Date(expiresAt).getTime()).toBeLessThanOrEqual(Date.now() + TWELVE_HOURS_MS)

    const rows = await Session.findAll({where: {sub: SESSION_ROUTE_SUB}, raw: true})
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      tokenHash: createHash('sha256').update(sessionId).digest('hex'),
      sub: SESSION_ROUTE_SUB,
      email: `${SESSION_ROUTE_SUB}@example.test`,
      siret: COMMUNE_SIRET,
      givenName: 'Camille',
      usualName: 'Test',
      acr: 'eidas1',
      amr: ['pwd'],
    })
    expect(JSON.stringify(rows[0])).not.toContain(sessionId)
    expect(rows[0].lastSeenAt).toBeInstanceOf(Date)
  })

  test('two logins give two sessions', async () => {
    const first = await login()
    const second = await login()

    expect(first.body.response.sessionId).not.toBe(second.body.response.sessionId)
    expect(await countSessions()).toBe(2)
  })

  test.each(invalidTokenCases)('$name gets 401 and stores nothing', async ({build}) => {
    const response = await postSession(await build({provider, sub: SESSION_ROUTE_SUB, siret: COMMUNE_SIRET}))

    expect(response.status).toBe(401)
    expect(await countSessions()).toBe(0)
  })

  test('a missing userinfo gets 400', async () => {
    const {idToken} = await provider.createTokens({sub: SESSION_ROUTE_SUB, siret: COMMUNE_SIRET})
    const response = await postSession({idToken})

    expect(response.status).toBe(400)
    expect(await countSessions()).toBe(0)
  })
})

describe('POST /api/session in the old mode', () => {
  const claims = buildSessionClaims({sub: SESSION_ROUTE_SUB, siret: COMMUNE_SIRET})

  test('claims without tokens get 400 when the old mode is off', async () => {
    const response = await postSession(claims)

    expect(response.status).toBe(400)
    expect(await countSessions()).toBe(0)
  })

  test('claims get 201, then 200 for the same claims, when the old mode is on', async () => {
    await withLegacyMode(async () => {
      expect((await postSession(claims)).status).toBe(201)
      expect((await postSession(claims)).status).toBe(200)
    })

    expect(await countSessions()).toBe(1)
  })

  test('only the claims are stored, other fields of the body are ignored', async () => {
    const sessionId = randomBytes(32).toString('base64url')
    const body = {
      ...claims,
      id: '00000000-0000-4000-8000-000000000000',
      tokenHash: createHash('sha256').update(sessionId).digest('hex'),
      acr: 'eidas3',
      amr: ['pwd'],
    }

    await withLegacyMode(async () => {
      expect((await postSession(body)).status).toBe(201)
    })

    const rows = await Session.findAll({where: {sub: SESSION_ROUTE_SUB}, raw: true})
    expect(rows).toHaveLength(1)
    expect(rows[0].id).not.toBe(body.id)
    expect(rows[0]).toMatchObject({tokenHash: null, acr: null, amr: null})
    expect((await listFavorites(sessionId)).status).toBe(401)
  })
})

describe('DELETE /api/session', () => {
  test('revokes the session: 204, then the session is refused, and a second DELETE still gets 204', async () => {
    const {sessionId} = (await login()).body.response
    expect((await listFavorites(sessionId)).status).toBe(200)

    expect((await deleteSession(sessionHeader(sessionId))).status).toBe(204)
    expect((await listFavorites(sessionId)).status).toBe(401)
    expect((await deleteSession(sessionHeader(sessionId))).status).toBe(204)
  })

  test('without the session header gets 400', async () => {
    const response = await deleteSession({})
    expect(response.status).toBe(400)
  })
})
