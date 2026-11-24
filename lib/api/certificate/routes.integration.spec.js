import request from 'supertest'
import {Certificate} from '../../util/sequelize.js'
import {
  buildApp,
  connectStores,
  useTestToken,
  insertDistrictFixtures,
  setDistrictConfig,
  ensureExternalRows,
  purgeFixtures,
  tearDown,
  TEST_ADDRESS_ID,
} from '../__integration__/helpers.js'

const app = buildApp()
let token

const postCertificate = () => request(app)
  .post('/api/certificate')
  .set('Authorization', `Token ${token}`)
  .send({addressID: TEST_ADDRESS_ID})

// eslint-disable-next-line camelcase
const countCertificates = () => Certificate.count({where: {address_id: TEST_ADDRESS_ID}})

beforeAll(async () => {
  await connectStores()
  await purgeFixtures()
  token = useTestToken()
  await ensureExternalRows()
  await insertDistrictFixtures()
})

afterAll(tearDown)

describe('POST /api/certificate', () => {
  test('a commune with certificate DISABLED gets 403 and no certificate', async () => {
    await setDistrictConfig({certificate: 'DISABLED'})
    const response = await postCertificate()

    expect(response.status).toBe(403)
    expect(await countCertificates()).toBe(0)
  })

  test('a commune with certificate DISTRICT gets 201', async () => {
    await setDistrictConfig({certificate: 'DISTRICT'})
    const certificatesBefore = await countCertificates()
    const response = await postCertificate()

    expect(response.status).toBe(201)
    expect(await countCertificates()).toBe(certificatesBefore + 1)
  })
})
