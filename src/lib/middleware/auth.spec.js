const {getAuthFromRequest, authMiddleware} = require('./auth')

const OLD_ENV = process.env

const fakeTooShortToken = 'azerty123456azerty123456azerty'
const fakeUnknownToken = '________UNKNOWN_TOKEN_WITH_GOOD_SIZE'
const fakeGoodToken = 'azerty123456azerty123456azerty123456'

const mockData = {
  authRequired: {
    requestToken: undefined,
    expected: {
      error: '401',
      message: 'Authentication required'
    },
  },
  unsupportedSheme: {
    requestToken: `foo ${fakeGoodToken}`,
    expected: {
      error: '401',
      message: 'Unsupported authentication scheme'
    },
  },
  tokenRequired: {
    requestToken: 'token',
    expected: {
      error: '401',
      message: 'Auth token required'
    }
  },
  invalidTooShortToken: {
    requestToken: `token ${fakeTooShortToken}`,
    expected: {
      error: '401',
      message: 'Invalid token'
    }
  },
  invalidUnknownToken: {
    requestToken: `token ${fakeUnknownToken}`,
    expected: {
      error: '401',
      message: 'Invalid token'
    }
  },
  authOk: {
    requestToken: `token ${fakeGoodToken}`,
    expected: {isAuth: true}
  }
}

const mockRequestResponse = authValue => ({
  headers: {authorization: mockData[authValue].requestToken},
  body: {}
})

describe('Test Auth function', () => {
  beforeEach(() => {
    // Clears the cache:
    jest.resetModules()

    // Update environment variables:
    process.env = {
      ...OLD_ENV,
      BAN_API_AUTHORIZED_TOKENS: OLD_ENV.BAN_API_AUTHORIZED_TOKENS ? `${OLD_ENV.BAN_API_AUTHORIZED_TOKENS},${fakeGoodToken}` : fakeGoodToken
    }
  })

  afterAll(() => {
    // Restore old environment variables:
    process.env = OLD_ENV
  })

  describe('getAuthFromRequest', () => {
    it('> Auth Required', () => {
      expect(getAuthFromRequest(mockRequestResponse('authRequired'))).toEqual(mockData.authRequired.expected)
    })
    it('> Unsupported Sheme', () => {
      expect(getAuthFromRequest(mockRequestResponse('unsupportedSheme'))).toEqual(mockData.unsupportedSheme.expected)
    })
    it('> Token Required', () => {
      expect(getAuthFromRequest(mockRequestResponse('tokenRequired'))).toEqual(mockData.tokenRequired.expected)
    })
    it('> Too short Token', () => {
      expect(getAuthFromRequest(mockRequestResponse('invalidTooShortToken'))).toEqual(mockData.invalidTooShortToken.expected)
    })
    it('> Unknown Token', () => {
      expect(getAuthFromRequest(mockRequestResponse('invalidUnknownToken'))).toEqual(mockData.invalidUnknownToken.expected)
    })
    it('> Auth Ok', () => {
      expect(getAuthFromRequest(mockRequestResponse('authOk'))).toEqual(mockData.authOk.expected)
    })
  })

  describe('authMiddleware', () => {
    let mockJsonFn
    let mockResponse
    const nextFunction = jest.fn()

    beforeEach(() => {
      mockJsonFn = jest.fn()
      mockResponse = {
        status: jest.fn(() => ({json: mockJsonFn})),
        json: mockJsonFn
      }
    })

    it('> Auth Required', async () => {
      await authMiddleware(mockRequestResponse('authRequired'), mockResponse, nextFunction)

      expect(mockResponse.status).toBeCalledWith(mockData.authRequired.expected.error)
      expect(mockJsonFn).toBeCalledWith({error: mockData.authRequired.expected.message})
    })
    it('> Unsupported Sheme', async () => {
      await authMiddleware(mockRequestResponse('unsupportedSheme'), mockResponse, nextFunction)

      expect(mockResponse.status).toBeCalledWith(mockData.unsupportedSheme.expected.error)
      expect(mockJsonFn).toBeCalledWith({error: mockData.unsupportedSheme.expected.message})
    })
    it('> Token Required', async () => {
      await authMiddleware(mockRequestResponse('tokenRequired'), mockResponse, nextFunction)

      expect(mockResponse.status).toBeCalledWith(mockData.tokenRequired.expected.error)
      expect(mockJsonFn).toBeCalledWith({error: mockData.tokenRequired.expected.message})
    })
    it('> Too short Token', async () => {
      await authMiddleware(mockRequestResponse('invalidTooShortToken'), mockResponse, nextFunction)

      expect(mockResponse.status).toBeCalledWith(mockData.invalidTooShortToken.expected.error)
      expect(mockJsonFn).toBeCalledWith({error: mockData.invalidTooShortToken.expected.message})
    })
    it('> Unknown Token', async () => {
      await authMiddleware(mockRequestResponse('invalidUnknownToken'), mockResponse, nextFunction)

      expect(mockResponse.status).toBeCalledWith(mockData.invalidUnknownToken.expected.error)
      expect(mockJsonFn).toBeCalledWith({error: mockData.invalidUnknownToken.expected.message})
    })
    it('> Auth Ok', async () => {
      await authMiddleware(mockRequestResponse('authOk'), mockResponse, nextFunction)

      expect(nextFunction).toHaveBeenCalled()
    })
  })
})
