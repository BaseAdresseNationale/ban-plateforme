import request from 'supertest'
import {Session} from '../../util/sequelize.js'
import {
  buildApp,
  connectStores,
  useTestToken,
  buildSessionClaims,
  purgeFixtures,
  tearDown,
  SESSION_ROUTE_SUB,
  COMMUNE_SIRET,
} from '../__integration__/helpers.js'

const app = buildApp()
const claims = buildSessionClaims({sub: SESSION_ROUTE_SUB, siret: COMMUNE_SIRET})
let token

const postSession = () => request(app)
  .post('/api/session')
  .set('Authorization', `Token ${token}`)
  .send(claims)

beforeAll(async () => {
  await connectStores()
  await purgeFixtures()
  token = useTestToken()
})

afterAll(tearDown)

describe('POST /api/session', () => {
  test('a new session gets 201', async () => {
    const response = await postSession()
    expect(response.status).toBe(201)
  })

  test('the same session again gets 200 and is stored once', async () => {
    const response = await postSession()

    expect(response.status).toBe(200)
    expect(await Session.count({where: {sub: SESSION_ROUTE_SUB}})).toBe(1)
  })
})
