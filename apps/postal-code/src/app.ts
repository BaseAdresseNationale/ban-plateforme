import express from 'express'

import { createPostalAdminRoutes } from './admin-routes.js'
import type { PostalAdministration } from './admin-routes.js'
import { isPostalAuthorized } from './auth.js'
import { parsePostalInput, PostalError } from './lookup.js'
import type { PostalInput, PostalResult } from './lookup.js'

interface AppDependencies {
  lookup(input: PostalInput): Promise<PostalResult>
  tokens: readonly string[]
  administration?: PostalAdministration
  now?: () => Date
}

export function createPostalApp({
  lookup, tokens, administration, now = () => new Date(),
}: AppDependencies) {
  const app = express()
  app.disable('x-powered-by')
  if (administration) app.use(createPostalAdminRoutes(administration, tokens, now))
  app.get('/postal-code/long-lat-insee-com', async (req, res) => {
    if (!isPostalAuthorized(req.get('authorization'), tokens)) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    const respond = (status: number, message: string, response: unknown) => {
      res.status(status).json({
        date: now().toISOString(),
        status: status < 300 ? 'success' : 'error',
        message,
        response,
      })
    }
    try {
      const input = parsePostalInput(req.query)
      const result = await lookup(input)
      respond(200, '[postal-code-service] Postal code request processed successfully', result)
    } catch (error) {
      if (error instanceof PostalError) respond(error.status, error.message, {})
      else respond(503, 'Postal service unavailable', {})
    }
  })
  return app
}
