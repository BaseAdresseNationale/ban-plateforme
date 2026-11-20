import express from 'express'
import type { ErrorRequestHandler, Response } from 'express'

import type { DatanovaUpdateResult } from './administration.js'
import { isPostalAuthorized } from './auth.js'
import { PostalReferenceError } from './reference-writer.js'

export interface PostalAdministration {
  datanova(input: unknown): Promise<DatanovaUpdateResult[]>
}

export function createPostalAdminRoutes(
  administration: PostalAdministration,
  tokens: readonly string[],
  now: () => Date,
) {
  const router = express.Router()
  const respond = (res: Response, code: number, message: string, response: unknown = {}) => {
    res.status(code).json({
      date: now().toISOString(), status: code < 300 ? 'success' : 'error', message, response,
    })
  }
  router.put('/postal-code/postal-datanova', (req, res, next) => {
    if (!isPostalAuthorized(req.get('authorization'), tokens)) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    if (!req.is('application/json')) {
      respond(res, 415, 'Expected application/json')
      return
    }
    next()
  }, express.json({ limit: '2mb', strict: true }), async (req, res) => {
    try {
      if (Object.keys(req.query).length !== 0) {
        throw new PostalReferenceError('invalid-reference', 'Unexpected query parameters')
      }
      const results = await administration.datanova(req.body)
      const totalUpdated = results.reduce((sum, item) => sum + item.updatedRowsCount, 0)
      const failedUpdates = results.filter(item => item.updatedRowsCount !== 1)
      if (failedUpdates.length) {
        respond(res, 207, 'Partial success', { totalUpdated, failedUpdates })
      }
      else respond(res, 200, 'Records updated successfully', { totalUpdated })
    } catch (error) {
      if (error instanceof PostalReferenceError && error.kind === 'invalid-reference') {
        respond(res, 400, 'Invalid postal update')
      } else if (error instanceof PostalReferenceError && error.kind === 'publication-unknown') {
        respond(res, 503, 'Postal publication outcome is unknown')
      } else respond(res, 503, 'Postal service unavailable')
    }
  })
  const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status = error !== null && typeof error === 'object' && 'status' in error
      ? error.status : undefined
    if (status === 413) respond(res, 413, 'Postal request too large')
    else if (status === 400) respond(res, 400, 'Invalid JSON body')
    else if (status === 415) respond(res, 415, 'Unsupported JSON encoding')
    else respond(res, 503, 'Postal service unavailable')
  }
  router.use(handleError)
  return router
}
