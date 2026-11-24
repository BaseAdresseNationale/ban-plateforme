import request from 'supertest'
import {Subscriber} from '../../util/sequelize.js'
import {
  buildApp,
  connectStores,
  useTestToken,
  purgeFixtures,
  tearDown,
  OWNER_ID,
  OTHER_OWNER_ID,
} from '../__integration__/helpers.js'

const app = buildApp()
let token
let ownerSubscription
let otherOwnerSubscription

const withToken = pendingRequest => pendingRequest.set('Authorization', `Token ${token}`)

beforeAll(async () => {
  await connectStores()
  await purgeFixtures()
  token = useTestToken()
  ownerSubscription = await Subscriber.create({webhookUrl: 'https://owner.example.test/hook', createdBy: OWNER_ID})
  otherOwnerSubscription = await Subscriber.create({webhookUrl: 'https://other-owner.example.test/hook', createdBy: OTHER_OWNER_ID})
})

afterAll(tearDown)

describe('GET /api/alerts/subscribers', () => {
  const listSubscribers = query => withToken(request(app).get('/api/alerts/subscribers').query(query))

  test('without createdBy gets 400', async () => {
    const response = await listSubscribers({})
    expect(response.status).toBe(400)
  })

  test('with an empty createdBy gets 400', async () => {
    const response = await listSubscribers('createdBy=')
    expect(response.status).toBe(400)
  })

  test('with several createdBy values gets 400', async () => {
    const response = await listSubscribers(`createdBy=${OWNER_ID}&createdBy=${OTHER_OWNER_ID}`)
    expect(response.status).toBe(400)
  })

  test('the owner gets 200 with only their subscriptions', async () => {
    const response = await listSubscribers({createdBy: OWNER_ID})

    expect(response.status).toBe(200)
    expect(response.body.response.subscriptions.map(({id}) => id)).toEqual([ownerSubscription.id])
  })
})

describe('GET /api/alerts/subscription/:id', () => {
  const getSubscription = ({id = ownerSubscription.id, query = {}} = {}) => request(app).get(`/api/alerts/subscription/${id}`).query(query)

  test('without token gets 401', async () => {
    const response = await getSubscription({query: {createdBy: OWNER_ID}})
    expect(response.status).toBe(401)
  })

  test('without createdBy gets 401', async () => {
    const response = await withToken(getSubscription())
    expect(response.status).toBe(401)
  })

  test('another owner gets 404', async () => {
    const response = await withToken(getSubscription({query: {createdBy: OTHER_OWNER_ID}}))
    expect(response.status).toBe(404)
  })

  test('a non-UUID id gets 400', async () => {
    const response = await withToken(getSubscription({id: 'not-a-uuid', query: {createdBy: OWNER_ID}}))
    expect(response.status).toBe(400)
  })

  test('the owner gets 200', async () => {
    const response = await withToken(getSubscription({query: {createdBy: OWNER_ID}}))

    expect(response.status).toBe(200)
    expect(response.body.response.id).toBe(ownerSubscription.id)
  })
})

describe('PATCH /api/alerts/subscription/:id', () => {
  const patchSubscription = ({id = ownerSubscription.id, body}) => withToken(request(app).patch(`/api/alerts/subscription/${id}`)).send(body)

  test('a non-UUID id gets 400', async () => {
    const response = await patchSubscription({id: 'not-a-uuid', body: {createdBy: OWNER_ID, subscriptionName: 'Renamed'}})
    expect(response.status).toBe(400)
  })

  test('an empty createdBy gets 401', async () => {
    const response = await patchSubscription({body: {createdBy: '', subscriptionName: 'Renamed'}})
    expect(response.status).toBe(401)
  })

  test('the owner gets 200 and the subscription is renamed', async () => {
    const response = await patchSubscription({body: {createdBy: OWNER_ID, subscriptionName: 'Renamed'}})

    expect(response.status).toBe(200)
    expect((await Subscriber.findByPk(ownerSubscription.id)).subscriptionName).toBe('Renamed')
  })
})

describe('DELETE /api/alerts/subscription/:id', () => {
  const deleteSubscription = ({id = otherOwnerSubscription.id, body}) => withToken(request(app).delete(`/api/alerts/subscription/${id}`)).send(body)

  test('a non-UUID id gets 400', async () => {
    const response = await deleteSubscription({id: 'not-a-uuid', body: {createdBy: OTHER_OWNER_ID}})
    expect(response.status).toBe(400)
  })

  test('an empty createdBy gets 401', async () => {
    const response = await deleteSubscription({body: {createdBy: ''}})
    expect(response.status).toBe(401)
  })

  test('the owner gets 200 and the subscription is gone', async () => {
    const response = await deleteSubscription({body: {createdBy: OTHER_OWNER_ID}})

    expect(response.status).toBe(200)
    expect(await Subscriber.findByPk(otherOwnerSubscription.id)).toBeNull()
  })
})
