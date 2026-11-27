import request from 'supertest'
import {sequelize} from '../../util/sequelize.js'
import {
  buildApp,
  connectStores,
  useTestToken,
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
const communeClaims = buildSessionClaims({sub: COMMUNE_SESSION_SUB, siret: COMMUNE_SIRET})
const otherCommuneClaims = buildSessionClaims({sub: OTHER_COMMUNE_SESSION_SUB, siret: OTHER_COMMUNE_SIRET})
let token

const enable = body => request(app)
  .patch('/api/district/addressing-certification/enable')
  .set('Authorization', `Token ${token}`)
  .send({districtID: TEST_DISTRICT_ID, ...body})

const getDistrictConfig = async () => {
  const [rows] = await sequelize.query('SELECT config FROM ban.district_config WHERE district_id = :districtId', {replacements: {districtId: TEST_DISTRICT_ID}})
  return rows[0]?.config ?? null
}

const getActionSirens = async () => {
  const [rows] = await sequelize.query('SELECT siren FROM ban.action WHERE "districtID" = :districtId', {replacements: {districtId: TEST_DISTRICT_ID}})
  return rows.map(({siren}) => siren)
}

beforeAll(async () => {
  await connectStores()
  await purgeFixtures()
  token = useTestToken()
  await ensureExternalRows()
  await insertDistrictFixtures()
  await insertSession(communeClaims)
  await insertSession(otherCommuneClaims)
})

// Each case starts without config, so no case ever updates it (see deleteDistrictConfig).
afterEach(deleteDistrictConfig)
afterAll(tearDown)

describe('PATCH /api/district/addressing-certification/enable', () => {
  test('a session of another commune gets 403 and writes nothing', async () => {
    const response = await enable({...otherCommuneClaims, config: {certificateIssuerDetails: 'Mairie de test'}})

    expect(response.status).toBe(403)
    expect(await getDistrictConfig()).toBeNull()
    expect(await getActionSirens()).toEqual([])
  })

  test('an invalid certificateType gets 400 and writes nothing', async () => {
    const response = await enable({...communeClaims, certificateType: 'FOO'})

    expect(response.status).toBe(400)
    expect(await getDistrictConfig()).toBeNull()
  })

  test('the commune session gets 200, the body siren is ignored and the commune SIREN is logged', async () => {
    const response = await enable({...communeClaims, siren: '123456789', config: {certificateIssuerDetails: 'Mairie de test'}})

    expect(response.status).toBe(200)
    expect(await getDistrictConfig()).toEqual({certificateIssuerDetails: 'Mairie de test'})
    expect(await getActionSirens()).toEqual([TEST_COMMUNE_SIREN])
  })
})
