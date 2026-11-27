import {analyticsErrorMiddleware} from './analytics.js'

const parseTokenList = value => (value || '').split(',').map(token => token.trim())

const getTokenAuthFromRequest = ({req, authorizedTokens}) => {
  const {headers = {}} = req
  const {authorization} = headers

  const [scheme, token] = authorization?.split(' ') || []

  if (!scheme) {
    return {
      error: '401',
      message: 'Authentication required'
    }
  }

  if (scheme.toLowerCase() !== 'token') {
    return {
      error: '401',
      message: 'Unsupported authentication scheme'
    }
  }

  if (!token) {
    return {
      error: '401',
      message: 'Auth token required'
    }
  }

  if (token.length !== 36 || !authorizedTokens.includes(token)) {
    return {
      error: '401',
      message: 'Invalid token'
    }
  }

  return {isAuth: true}
}

export const getAuthFromRequest = req =>
  getTokenAuthFromRequest({req, authorizedTokens: parseTokenList(process.env.BAN_API_AUTHORIZED_TOKENS)})

// Admin tokens live in their own list: a service token never grants admin routes.
const getAdminAuthFromRequest = req =>
  getTokenAuthFromRequest({req, authorizedTokens: parseTokenList(process.env.BAN_API_ADMIN_TOKENS)})

const createTokenMiddleware = getAuth => async (req, res, next) => {
  try {
    const {error, message} = getAuth(req)
    if (error) {
      analyticsErrorMiddleware({req, error: message})
      res.status(error).json({
        error: message,
      })
      return
    }

    next()
  } catch (error) {
    console.error('AUTH ERROR !', error)
    analyticsErrorMiddleware({req, error})
    res.status(500).json({
      error: 'Internal Server Error',
    })
  }
}

export const authMiddleware = createTokenMiddleware(getAuthFromRequest)

export const adminAuthMiddleware = createTokenMiddleware(getAdminAuthFromRequest)

export default authMiddleware
