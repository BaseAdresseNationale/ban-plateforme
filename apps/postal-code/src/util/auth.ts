import { env } from '@ban/config';
import { logger } from '@ban/tools';

export const getAuthFromRequest = req => {
  const authorizedTokens = (env.PC.adminToken || '')?.split(',').map(token => token.trim())

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
      res.status(Number(error)).json({
        error: message,
      })
      return
    }

    next()
  } catch (error) {
    logger.error('AUTH ERROR !', error)
    res.status(500).json({
      error: 'Internal Server Error',
    })
  }
}

export default authMiddleware
