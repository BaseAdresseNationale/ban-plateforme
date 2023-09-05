import {analyticsErrorMiddleware} from './analytics.js'

export const getAuthFromRequest = req => {
  const authorizedTokens = (process.env.BAN_API_AUTHORIZED_TOKENS || '')?.split(',').map(token => token.trim())

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

export const authMiddleware = async (req, res, next) => {
  try {
    const {error, message} = getAuthFromRequest(req)
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

export default authMiddleware
