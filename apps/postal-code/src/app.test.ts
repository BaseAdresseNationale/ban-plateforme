import { EventEmitter } from 'node:events'
import { fileURLToPath } from 'node:url'

import SwaggerParser from '@apidevtools/swagger-parser'
import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

import { createPostalApp } from './app.js'
import { PostalError } from './lookup.js'

const token = 'f'.repeat(36)
const result = {
  code_postal: '96001',
  libelle_acheminement: 'VILLE FICTIVE',
  libelles_acheminement: { '96001': 'VILLE FICTIVE' },
}
const now = () => new Date('2026-01-01T00:00:00.000Z')

async function request(
  app: ReturnType<typeof createPostalApp>,
  url = '/postal-code/long-lat-insee-com?inseeCom=96001',
  authorization: string | undefined = `Token ${token}`,
  method = 'GET',
) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const req = Object.assign(new EventEmitter(), {
      url, method, headers: authorization ? { authorization } : {},
    }) as Request
    const headers = new Map<string, string>()
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
      getHeader: (name: string) => headers.get(name.toLowerCase()),
      removeHeader: (name: string) => headers.delete(name.toLowerCase()),
      end(this: Response, body?: string | Buffer) {
        resolve({ status: this.statusCode, body: body ? JSON.parse(body.toString()) : {} })
      },
    }) as unknown as Response
    app(req, res, (error?: unknown) => {
      if (error) reject(error)
      else resolve({ status: 404, body: {} })
    })
  })
}

describe('postal HTTP contract', () => {
  it('preserves the success envelope and adds paired labels', async () => {
    const lookup = vi.fn().mockResolvedValue(result)
    const app = createPostalApp({ lookup, tokens: [token], now })
    expect(await request(app)).toEqual({ status: 200, body: {
      date: now().toISOString(), status: 'success',
      message: '[postal-code-service] Postal code request processed successfully',
      response: result,
    } })
    expect(lookup).toHaveBeenCalledWith({ inseeCom: '96001' })
  })

  it('authenticates before validating parameters or reading the database', async () => {
    const lookup = vi.fn()
    const app = createPostalApp({ lookup, tokens: [token] })
    expect((await request(app, '/postal-code/long-lat-insee-com', '')).status).toBe(401)
    expect(lookup).not.toHaveBeenCalled()
    expect((await request(app, undefined, `Bearer ${token}`)).status).toBe(401)
    const closed = createPostalApp({ lookup, tokens: [] })
    expect((await request(closed)).status).toBe(401)
    expect(lookup).not.toHaveBeenCalled()
  })

  it('rejects invalid coordinates and unknown parameters without reading', async () => {
    const lookup = vi.fn()
    const app = createPostalApp({ lookup, tokens: [token] })
    for (const query of ['long=2', 'long=2&lat=95', 'inseeCom=96001&x=2']) {
      const response = await request(app, `/postal-code/long-lat-insee-com?${query}`)
      expect(response.status).toBe(400)
      expect(response.body.status).toBe('error')
    }
    expect(lookup).not.toHaveBeenCalled()
  })

  it.each([404, 409, 503] as const)('returns an explicit domain failure %s', async status => {
    const lookup = vi.fn().mockRejectedValue(
      new PostalError(status, 'Public postal error'),
    )
    const response = await request(createPostalApp({ lookup, tokens: [token] }))
    expect(response.status).toBe(status)
    expect(response.body).toMatchObject({ status: 'error', response: {} })
  })

  it('never returns SQL diagnostics or a success for repository failures', async () => {
    const lookup = vi.fn().mockRejectedValue(new Error('private SQL diagnostic'))
    const response = await request(createPostalApp({ lookup, tokens: [token] }))
    expect(response.status).toBe(503)
    expect(response.body.status).toBe('error')
    expect(JSON.stringify(response.body)).not.toContain('private SQL diagnostic')
  })

  it('keeps writes disabled by default and hides files and broken positional aliases', async () => {
    const lookup = vi.fn().mockResolvedValue(result)
    const app = createPostalApp({ lookup, tokens: [token] })
    expect((await request(app, undefined, undefined, 'POST')).status).toBe(404)
    const excluded = [
      '/.env', '/postal-code/postal-area', '/postal-code/long-lat-insee-com/96001',
    ]
    for (const url of excluded) {
      expect((await request(app, url)).status).toBe(404)
    }
    expect(lookup).not.toHaveBeenCalled()
  })

  it('validates the local OpenAPI, its auth and all effective response codes', async () => {
    const source = new URL('../openapi.yaml', import.meta.url)
    const document = await SwaggerParser.validate(fileURLToPath(source), {
      resolve: { http: false },
    })
    const operation = document.paths?.['/postal-code/long-lat-insee-com']?.get
    expect(operation?.security).toEqual([{ PostalToken: [] }])
    expect(Object.keys(operation?.responses ?? {}).sort())
      .toEqual(['200', '400', '401', '404', '409', '503'])
    expect(operation?.parameters).toHaveLength(3)
  })
})
