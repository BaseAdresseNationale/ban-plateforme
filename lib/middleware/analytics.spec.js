import {jest} from '@jest/globals'

const OLD_ENV = process.env

let analyticsMiddleware
let analyticsErrorMiddleware

const fakePathName = 'fake-path-name'
const getFakeRequest = ({url = '/fake/url/fake.url', method = 'GET', baseUrl = `/${fakePathName}`} = {}) => ({
  url,
  method,
  baseUrl,
  body: {fake: 'body'},
  headers: {fake: 'headers'},
  query: {fake: 'query'},
})
const fakeErrorContent = 'fake-error-content'

const fakeResponse = {
  fake: 'response',
}
const fakeNext = jest.fn()
const sendToTracker = jest.fn()

describe('Test Auth function', () => {
  beforeEach(async () => {
    // Clears the cache:
    jest.resetModules()

    // Disable console.log, console.info, console.warn:
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'info').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()

    // Mock analytics-tracker:
    jest.unstable_mockModule('../util/analytics-tracker.js', async () =>
      ({
        sendToTracker,
        default: jest.fn()
      })
    )

    const analytics = await import('./analytics.js')
    analyticsMiddleware = analytics.analyticsMiddleware
    analyticsErrorMiddleware = analytics.analyticsErrorMiddleware

    // Update environment variables:
    process.env = {
      ...OLD_ENV,
    }
  })

  afterAll(() => {
    // Restore old environment variables:
    process.env = OLD_ENV

    // Restore the spy created with spyOn
    jest.restoreAllMocks()
  })

  describe('analyticsMiddleware', () => {
    it('> Event: Read', async () => {
      const fakeRequest = getFakeRequest({method: 'GET'})
      await analyticsMiddleware(fakeRequest, fakeResponse, fakeNext)

      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
      expect(fakeNext).toHaveBeenCalled()
    })
    it('> Event: Create', async () => {
      const fakeRequest = getFakeRequest({method: 'POST'})
      await analyticsMiddleware(fakeRequest, fakeResponse, fakeNext)

      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
      expect(fakeNext).toHaveBeenCalled()
    })
    it('> Event: Update', async () => {
      const fakeRequest = getFakeRequest({method: 'PUT'})
      await analyticsMiddleware(fakeRequest, fakeResponse, fakeNext)

      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
      expect(fakeNext).toHaveBeenCalled()
    })
    it('> Event: Single Delete', async () => {
      const fakeRequest = getFakeRequest({method: 'DELETE'})
      await analyticsMiddleware(fakeRequest, fakeResponse, fakeNext)

      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
      expect(fakeNext).toHaveBeenCalled()
    })
    it('> Event: Unknow Method', async () => {
      const nameSubAPI = 'Test-sub-API'
      const fakeRequest = getFakeRequest({url: `/${nameSubAPI}/fake/url/fake.url`, method: 'UNKNOW_METHOD'})
      await analyticsMiddleware(fakeRequest, fakeResponse, fakeNext)

      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
      expect(fakeNext).toHaveBeenCalled()
    })

    it('> Event: Request COG', async () => {
      const nameSubAPI = 'cog'
      const fakeRequest = getFakeRequest({url: `/${nameSubAPI}/fake/url/fake.url`, method: 'GET'})
      await analyticsMiddleware(fakeRequest, fakeResponse, fakeNext)

      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
      expect(fakeNext).toHaveBeenCalled()
    })
    it('> Event: Request Delta Report', async () => {
      const nameSubAPI = 'delta-report'
      const fakeRequest = getFakeRequest({url: `/${nameSubAPI}/fake/url/fake.url`, method: 'POST'})
      await analyticsMiddleware(fakeRequest, fakeResponse, fakeNext)

      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
      expect(fakeNext).toHaveBeenCalled()
    })
    it('> Event: Multi Delete', async () => {
      const nameSubAPI = 'delete'
      const fakeRequest = getFakeRequest({url: `/${nameSubAPI}/fake/url/fake.url`, method: 'POST'})
      await analyticsMiddleware(fakeRequest, fakeResponse, fakeNext)
      //   Const expectedParam = getFakeAnalitycsParams(fakeRequest, 'Suppression Multiple')
      //   expect(sendToTracker).toHaveBeenLastCalledWith(expectedParam)
      //   console.log('CALL ARGS >>>', argCall)

      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
      expect(fakeNext).toHaveBeenCalled()
    })

    it('> Event: Invalid Method on Request COG', async () => {
      const nameSubAPI = 'cog'
      const fakeRequest = getFakeRequest({url: `/${nameSubAPI}/fake/url/fake.url`, method: 'POST'})
      await analyticsMiddleware(fakeRequest, fakeResponse, fakeNext)

      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
      expect(fakeNext).toHaveBeenCalled()
    })
    it('> Event: Invalid Method on Request Delta Report', async () => {
      const nameSubAPI = 'delta-report'
      const fakeRequest = getFakeRequest({url: `/${nameSubAPI}/fake/url/fake.url`, method: 'UNKNOW_METHOD'})
      await analyticsMiddleware(fakeRequest, fakeResponse, fakeNext)

      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
      expect(fakeNext).toHaveBeenCalled()
    })
    it('> Event: Invalid Method on Multi Delete', async () => {
      const nameSubAPI = 'delete'
      const fakeRequest = getFakeRequest({url: `/${nameSubAPI}/fake/url/fake.url`, method: 'UNKNOW_METHOD'})
      await analyticsMiddleware(fakeRequest, fakeResponse, fakeNext)

      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
      expect(fakeNext).toHaveBeenCalled()
    })
  })

  describe('analyticsErrorMiddleware', () => {
    it('> Error on Unknow Method', async () => {
      const nameSubAPI = 'error-test-API'
      const fakeRequest = getFakeRequest({url: `/${nameSubAPI}/fake/url/fake.url`, method: 'UNKNOW_METHOD'})

      analyticsErrorMiddleware({req: fakeRequest, error: fakeErrorContent})
      const argCall = sendToTracker.mock.lastCall
      expect(argCall).toMatchSnapshot()
    })
  })
  it('> Error on Classic Method (POST)', async () => {
    const nameSubAPI = 'error-test-API'
    const fakeRequest = getFakeRequest({url: `/${nameSubAPI}/fake/url/fake.url`, method: 'POST'})

    analyticsErrorMiddleware({req: fakeRequest, error: fakeErrorContent})
    const argCall = sendToTracker.mock.lastCall
    expect(argCall).toMatchSnapshot()
  })
})
