import express from 'express'
import type { ErrorRequestHandler, Request, Response } from 'express'

import type { DatanovaUpdateResult } from './administration.js'
import { isPostalAuthorized } from './auth.js'
import { PostalReferenceError } from './reference-writer.js'

export interface PostalAdministration {
  datanova(input: unknown): Promise<DatanovaUpdateResult[]>
  areas(cog: string, input: unknown): Promise<{ createdCount: number; deletedCount: number }>
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
  const register = (
    path: string,
    limit: string,
    operation: (req: Request, res: Response) => Promise<void>,
  ) => router.put(path, (req, res, next) => {
    if (!isPostalAuthorized(req.get('authorization'), tokens)) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    if (!req.is('application/json')) {
      respond(res, 415, 'Expected application/json')
      return
    }
    next()
  }, express.json({ limit, strict: true }), async (req, res) => {
    try {
      if (Object.keys(req.query).length !== 0) {
        throw new PostalReferenceError('invalid-reference', 'Unexpected query parameters')
      }
      await operation(req, res)
    } catch (error) {
      if (error instanceof PostalReferenceError && error.kind === 'invalid-reference') {
        respond(res, 400, 'Invalid postal update')
      } else if (error instanceof PostalReferenceError && error.kind === 'publication-unknown') {
        respond(res, 503, 'Postal publication outcome is unknown')
      } else respond(res, 503, 'Postal service unavailable')
    }
  })
  register('/postal-code/postal-datanova', '2mb', async (req, res) => {
    const results = await administration.datanova(req.body)
    const totalUpdated = results.reduce((sum, item) => sum + item.updatedRowsCount, 0)
    const failedUpdates = results.filter(item => item.updatedRowsCount !== 1)
    if (failedUpdates.length) {
      respond(res, 207, 'Partial success', { totalUpdated, failedUpdates })
    } else respond(res, 200, 'Records updated successfully', { totalUpdated })
  })
  register('/postal-code/postal-area/district/cog/:cog', '20mb', async (req, res) => {
    const result = await administration.areas(String(req.params.cog), req.body)
    respond(res, 200, 'Postal areas updated', result)
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
