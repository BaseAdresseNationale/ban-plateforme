import request from 'supertest'
import {Subscriber} from '../../util/sequelize.js'
import {
  buildApp,
  connectStores,
  useTestToken,
  useFakeProConnect,
  createTestSession,
  sessionHeader,
  withLegacyMode,
  purgeFixtures,
  tearDown,
  OWNER_ID,
  OTHER_OWNER_ID,
  COMMUNE_SIRET,
} from '../__integration__/helpers.js'

const app = buildApp()
let token
let ownerSessionId
let otherOwnerSessionId
let ownerSubscription
let webhookCount = 0

const withToken = pendingRequest => pendingRequest.set('Authorization', `Token ${token}`)

const createSubscription = createdBy => {
  webhookCount++
  return Subscriber.create({webhookUrl: `https://hook-${webhookCount}.example.test/hook`, createdBy})
}

const postSubscriber = ({headers = {}, body}) => withToken(request(app).post('/api/alerts/subscribers')).set(headers).send(body)
const listSubscribers = ({headers = {}, query = {}}) => withToken(request(app).get('/api/alerts/subscribers')).set(headers).query(query)
const getSubscription = ({id, headers = {}, query = {}}) => withToken(request(app).get(`/api/alerts/subscription/${id}`)).set(headers).query(query)
const patchSubscription = ({id, headers = {}, body}) => withToken(request(app).patch(`/api/alerts/subscription/${id}`)).set(headers).send(body)
const deleteSubscription = ({id, headers = {}, body = {}}) => withToken(request(app).delete(`/api/alerts/subscription/${id}`)).set(headers).send(body)

beforeAll(async () => {
  await connectStores()
  await purgeFixtures()
  token = useTestToken()
  await useFakeProConnect()
  ownerSessionId = await createTestSession({sub: OWNER_ID, siret: COMMUNE_SIRET})
  otherOwnerSessionId = await createTestSession({sub: OTHER_OWNER_ID, siret: COMMUNE_SIRET})
  ownerSubscription = await createSubscription(OWNER_ID)
  await createSubscription(OTHER_OWNER_ID)
})

afterAll(tearDown)

describe('alerts with a session', () => {
  test('creation stores the session sub and email, whatever the body says', async () => {
    const response = await postSubscriber({
      headers: sessionHeader(ownerSessionId),
      body: {webhookUrl: 'https://created.example.test/hook', createdBy: OTHER_OWNER_ID, createdByEmail: 'other@example.test'},
    })

    expect(response.status).toBe(201)
    const created = await Subscriber.findByPk(response.body.response.id)
    expect(created.createdBy).toBe(OWNER_ID)
    expect(created.createdByEmail).toBe(`${OWNER_ID}@example.test`)
  })

  test('the list holds only the subscriptions of the session, whatever the query says', async () => {
    const response = await listSubscribers({headers: sessionHeader(ownerSessionId), query: {createdBy: OTHER_OWNER_ID}})

    expect(response.status).toBe(200)
    const owners = response.body.response.subscriptions.map(({createdBy}) => createdBy)
    expect(owners.length).toBeGreaterThan(0)
    expect(new Set(owners)).toEqual(new Set([OWNER_ID]))
  })

  test('another agent gets 404 on GET, PATCH and DELETE, even with the owner as createdBy', async () => {
    const headers = sessionHeader(otherOwnerSessionId)
    const {id} = ownerSubscription

    expect((await getSubscription({id, headers, query: {createdBy: OWNER_ID}})).status).toBe(404)
    expect((await patchSubscription({id, headers, body: {createdBy: OWNER_ID, subscriptionName: 'Hijacked'}})).status).toBe(404)
    expect((await deleteSubscription({id, headers, body: {createdBy: OWNER_ID}})).status).toBe(404)

    const unchanged = await Subscriber.findByPk(id)
    expect(unchanged).not.toBeNull()
    expect(unchanged.subscriptionName).not.toBe('Hijacked')
  })

  test('a non-UUID id gets 400', async () => {
    const response = await getSubscription({id: 'not-a-uuid', headers: sessionHeader(ownerSessionId)})
    expect(response.status).toBe(400)
  })

  test('the owner gets 200 on GET and PATCH', async () => {
    const headers = sessionHeader(ownerSessionId)
    const {id} = ownerSubscription

    const read = await getSubscription({id, headers})
    expect(read.status).toBe(200)
    expect(read.body.response.id).toBe(id)

    expect((await patchSubscription({id, headers, body: {subscriptionName: 'Renamed'}})).status).toBe(200)
    expect((await Subscriber.findByPk(id)).subscriptionName).toBe('Renamed')
  })

  test('the owner gets 200 on DELETE and the subscription is gone', async () => {
    const subscription = await createSubscription(OWNER_ID)

    const response = await deleteSubscription({id: subscription.id, headers: sessionHeader(ownerSessionId)})

    expect(response.status).toBe(200)
    expect(await Subscriber.findByPk(subscription.id)).toBeNull()
  })
})

describe('alerts without a session header', () => {
  test('the five routes get 401 when the old mode is off', async () => {
    const {id} = ownerSubscription
    const responses = [
      await postSubscriber({body: {webhookUrl: 'https://refused.example.test/hook', createdBy: OWNER_ID}}),
      await listSubscribers({query: {createdBy: OWNER_ID}}),
      await getSubscription({id, query: {createdBy: OWNER_ID}}),
      await patchSubscription({id, body: {createdBy: OWNER_ID, subscriptionName: 'Refused'}}),
      await deleteSubscription({id, body: {createdBy: OWNER_ID}}),
    ]

    expect(responses.map(({status}) => status)).toEqual([401, 401, 401, 401, 401])
    expect(await Subscriber.findByPk(id)).not.toBeNull()
  })

  test('old mode: creation takes createdBy from the body', async () => {
    const response = await withLegacyMode(() => postSubscriber({body: {webhookUrl: 'https://legacy.example.test/hook', createdBy: OWNER_ID}}))

    expect(response.status).toBe(201)
    expect((await Subscriber.findByPk(response.body.response.id)).createdBy).toBe(OWNER_ID)
  })

  test('old mode: the list needs createdBy in the query', async () => {
    const missing = await withLegacyMode(() => listSubscribers({}))
    const owned = await withLegacyMode(() => listSubscribers({query: {createdBy: OWNER_ID}}))

    expect(missing.status).toBe(400)
    expect(owned.status).toBe(200)
  })

  test('old mode: GET, PATCH and DELETE use createdBy', async () => {
    const {id} = ownerSubscription
    const subscription = await createSubscription(OWNER_ID)

    expect((await withLegacyMode(() => getSubscription({id, query: {createdBy: OWNER_ID}}))).status).toBe(200)
    expect((await withLegacyMode(() => getSubscription({id}))).status).toBe(401)
    expect((await withLegacyMode(() => patchSubscription({id, body: {createdBy: OWNER_ID, subscriptionName: 'Legacy'}}))).status).toBe(200)
    expect((await withLegacyMode(() => deleteSubscription({id: subscription.id, body: {createdBy: OWNER_ID}}))).status).toBe(200)
  })
})
