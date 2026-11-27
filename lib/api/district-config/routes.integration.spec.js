import {randomUUID} from 'node:crypto'
import request from 'supertest'
import {
  buildApp,
  connectStores,
  useTestToken,
  restoreEnv,
  insertDistrictFixtures,
  deleteDistrictConfig,
  setDistrictConfig,
  purgeFixtures,
  tearDown,
  TEST_DISTRICT_ID,
} from '../__integration__/helpers.js'

const app = buildApp()
const INITIAL_CONFIG = {certificateIssuerDetails: 'Mairie de test'}
const ADMIN_CONFIG = {certificateIssuerDetails: 'Mairie modifiée'}
let serviceToken
let adminToken
let previousAdminTokens

const getConfig = token => request(app)
  .get(`/api/district-config/${TEST_DISTRICT_ID}`)
  .set('Authorization', `Token ${token}`)

const patchConfig = token => request(app)
  .patch(`/api/district-config/${TEST_DISTRICT_ID}`)
  .set('Authorization', `Token ${token}`)
  .send(ADMIN_CONFIG)

beforeAll(async () => {
  await connectStores()
  await purgeFixtures()
  serviceToken = useTestToken()
  adminToken = randomUUID()
  previousAdminTokens = process.env.BAN_API_ADMIN_TOKENS
  process.env.BAN_API_ADMIN_TOKENS = adminToken
  await insertDistrictFixtures()
})

// A PATCH that changes an existing config would write ban.district_config_h: each case starts without config.
afterEach(deleteDistrictConfig)

afterAll(async () => {
  restoreEnv({name: 'BAN_API_ADMIN_TOKENS', value: previousAdminTokens})
  await tearDown()
})

describe('/api/district-config/:districtId', () => {
  test('PATCH with the service token gets 401 and the config is unchanged', async () => {
    await setDistrictConfig(INITIAL_CONFIG)

    const response = await patchConfig(serviceToken)

    expect(response.status).toBe(401)
    expect((await getConfig(serviceToken)).body.response.config).toEqual(INITIAL_CONFIG)
  })

  test('PATCH with an admin token gets 200', async () => {
    const response = await patchConfig(adminToken)

    expect(response.status).toBe(200)
    expect(response.body.response.config).toEqual(ADMIN_CONFIG)
  })

  test('GET with the service token gets 200', async () => {
    await setDistrictConfig(INITIAL_CONFIG)

    const response = await getConfig(serviceToken)

    expect(response.status).toBe(200)
    expect(response.body.response.config).toEqual(INITIAL_CONFIG)
  })
})
