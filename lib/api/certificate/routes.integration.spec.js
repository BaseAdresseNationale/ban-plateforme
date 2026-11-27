import request from 'supertest'
import {Certificate} from '../../util/sequelize.js'
import {
  buildApp,
  connectStores,
  useTestToken,
  useFakeProConnect,
  createTestSession,
  sessionHeader,
  withLegacyMode,
  insertDistrictFixtures,
  setDistrictConfig,
  ensureExternalRows,
  purgeFixtures,
  tearDown,
  TEST_ADDRESS_ID,
  COMMUNE_SESSION_SUB,
  COMMUNE_SIRET,
  OTHER_COMMUNE_SESSION_SUB,
  OTHER_COMMUNE_SIRET,
} from '../__integration__/helpers.js'

const app = buildApp()
let token
let communeSessionId
let otherCommuneSessionId

const postCertificate = (headers = {}) => request(app)
  .post('/api/certificate')
  .set('Authorization', `Token ${token}`)
  .set(headers)
  .send({addressID: TEST_ADDRESS_ID})

// eslint-disable-next-line camelcase
const countCertificates = () => Certificate.count({where: {address_id: TEST_ADDRESS_ID}})

const expectCertificateRequest = async ({send, status}) => {
  const certificatesBefore = await countCertificates()
  const response = await send()

  expect(response.status).toBe(status)
  expect(await countCertificates()).toBe(certificatesBefore + (status === 201 ? 1 : 0))
}

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

afterAll(tearDown)

describe('POST /api/certificate', () => {
  test('a commune with certificate DISABLED gets 403 and no certificate', async () => {
    await setDistrictConfig({certificate: 'DISABLED'})
    await expectCertificateRequest({send: () => postCertificate(sessionHeader(communeSessionId)), status: 403})
  })

  test('ALL mode without a session header gets 201', async () => {
    await setDistrictConfig({certificate: 'ALL'})
    await expectCertificateRequest({send: () => postCertificate(), status: 201})
  })

  describe('DISTRICT mode', () => {
    beforeAll(() => setDistrictConfig({certificate: 'DISTRICT'}))

    test('without a session header gets 401 and no certificate when the old mode is off', async () => {
      await expectCertificateRequest({send: () => postCertificate(), status: 401})
    })

    test('without a session header gets 201 when the old mode is on', async () => {
      await expectCertificateRequest({send: () => withLegacyMode(() => postCertificate()), status: 201})
    })

    test('a session of another commune gets 403 and no certificate', async () => {
      await expectCertificateRequest({send: () => postCertificate(sessionHeader(otherCommuneSessionId)), status: 403})
    })

    test('a session of the commune gets 201', async () => {
      await expectCertificateRequest({send: () => postCertificate(sessionHeader(communeSessionId)), status: 201})
    })
  })
})
