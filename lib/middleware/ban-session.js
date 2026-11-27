import {BAN_SESSION_HEADER, isLegacySessionModeEnabled} from '../api/session/config.js'
import {findActiveSession} from '../api/session/models.js'
import {analyticsErrorMiddleware} from './analytics.js'
import {proConnectMiddleware} from './pro-connect.js'

const rejectRequest = ({req, res, status, message}) => {
  analyticsErrorMiddleware({req, error: message})
  res.status(status).json({error: message})
}

// An invalid header never falls back to the old mode: identifyLegacy runs only when the header is absent.
const createSessionMiddleware = identifyLegacy => async (req, res, next) => {
  try {
    const sessionId = req.get(BAN_SESSION_HEADER)

    if (!sessionId) {
      if (isLegacySessionModeEnabled()) {
        await identifyLegacy(req, res, next)
        return
      }

      rejectRequest({req, res, status: 401, message: 'Session requise'})
      return
    }

    const session = await findActiveSession(sessionId)
    if (!session) {
      rejectRequest({req, res, status: 401, message: 'Session inconnue, expirée ou inactive'})
      return
    }

    req.sessionID = session.id
    req.userID = session.sub
    req.sessionSiret = session.siret
    req.sessionEmail = session.email
    next()
  } catch (error) {
    console.error(`Session middleware error: ${error.message}`)
    analyticsErrorMiddleware({req, error})
    res.status(500).json({
      error: 'Internal Server Error',
    })
  }
}

export const sessionMiddleware = createSessionMiddleware(proConnectMiddleware)
