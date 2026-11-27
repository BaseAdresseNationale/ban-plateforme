import request from 'supertest'
import {UserPreference} from '../../util/sequelize.js'
import {
  buildApp,
  connectStores,
  useTestToken,
  useFakeProConnect,
  createTestSession,
  sessionHeader,
  insertDistrictFixtures,
  purgeFixtures,
  tearDown,
  TEST_DISTRICT_ID,
  FAVORITES_SESSION_SUB,
  OTHER_COMMUNE_SESSION_SUB,
  COMMUNE_SIRET,
} from '../__integration__/helpers.js'

const app = buildApp()
let token
let sessionId

const postFavorites = ({path, headers = {}, body = {}}) => request(app)
  .post(`/api/user-preferences/favorites${path}`)
  .set('Authorization', `Token ${token}`)
  .set(headers)
  .send(body)

const getStoredFavoriteIds = async userId => {
  const user = await UserPreference.findByPk(userId)
  return (user?.data?.favorites?.districts ?? []).map(({districtID}) => districtID)
}

beforeAll(async () => {
  await connectStores()
  await purgeFixtures()
  token = useTestToken()
  await useFakeProConnect()
  await insertDistrictFixtures()
  sessionId = await createTestSession({sub: FAVORITES_SESSION_SUB, siret: COMMUNE_SIRET})
})

afterAll(tearDown)

describe('favorites are bound to the session identity', () => {
  test('without the session header, each route gets 401', async () => {
    for (const path of ['/list', '', '/delete']) {
      // eslint-disable-next-line no-await-in-loop
      const response = await postFavorites({path, body: {sub: FAVORITES_SESSION_SUB, districtID: TEST_DISTRICT_ID}})
      expect(response.status).toBe(401)
    }
  })

  test('add stores the favorite under the session sub, ignoring a sub in the body', async () => {
    const response = await postFavorites({
      path: '',
      headers: sessionHeader(sessionId),
      body: {sub: OTHER_COMMUNE_SESSION_SUB, districtID: TEST_DISTRICT_ID},
    })

    expect(response.status).toBe(201)
    expect(await getStoredFavoriteIds(FAVORITES_SESSION_SUB)).toEqual([TEST_DISTRICT_ID])
    expect(await UserPreference.findByPk(OTHER_COMMUNE_SESSION_SUB)).toBeNull()
  })

  test('list returns the favorites of the session sub', async () => {
    const response = await postFavorites({path: '/list', headers: sessionHeader(sessionId), body: {sub: OTHER_COMMUNE_SESSION_SUB}})

    expect(response.status).toBe(200)
    expect(response.body.response.favorites.map(({districtID}) => districtID)).toEqual([TEST_DISTRICT_ID])
  })

  test('delete removes the favorite of the session sub', async () => {
    const response = await postFavorites({path: '/delete', headers: sessionHeader(sessionId), body: {districtID: TEST_DISTRICT_ID}})

    expect(response.status).toBe(200)
    expect(await getStoredFavoriteIds(FAVORITES_SESSION_SUB)).toEqual([])
  })
})
