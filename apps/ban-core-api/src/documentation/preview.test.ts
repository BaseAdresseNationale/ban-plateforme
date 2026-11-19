import { EventEmitter } from 'node:events'

import type { Request, Response } from 'express'
import express from 'express'
import { describe, expect, it, vi } from 'vitest'

import { createDocumentationApp, parseDocumentationPort } from './preview.js'

// Passage par le vrai routeur Express, sans socket ni dépendance métier.
async function request(app: ReturnType<typeof express>, url: string, method = 'GET') {
  type Result = { status: number; body: string; type?: string; allow?: string }
  return new Promise<Result>((resolve, reject) => {
    const req = Object.assign(new EventEmitter(), { url, method, headers: {} }) as Request
    const headers = new Map<string, string>()
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
      getHeader: (name: string) => headers.get(name.toLowerCase()),
      removeHeader: (name: string) => headers.delete(name.toLowerCase()),
      end(this: Response, body?: string) {
        const type = headers.get('content-type')
        resolve({
          status: this.statusCode,
          body: body?.toString() ?? '',
          type,
          allow: headers.get('allow'),
        })
      },
    }) as unknown as Response
    app(req, res, (error?: unknown) => {
      if (error) reject(error)
      else resolve({ status: 404, body: '' })
    })
  })
}

describe('local documentation preview', () => {
  it('serves the viewer and disables API execution and remote validation', async () => {
    const app = createDocumentationApp()
    const page = await request(app, '/')
    expect(page.status).toBe(200)
    expect(page.type).toContain('text/html')
    expect(page.body).toContain('/assets/swagger-ui-bundle.js')
    const script = await request(app, '/preview.js')
    expect(script.body).toContain('supportedSubmitMethods: []')
    expect(script.body).toContain('validatorUrl: null')
    expect(script.body).toContain('setInterval(refreshDocumentation, 2000)')
  })

  it('reloads the contract and reports invalid edits without a stale success', async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({ openapi: '3.1.0', paths: {} })
      .mockRejectedValueOnce(new Error('private diagnostic'))
      .mockResolvedValueOnce({ openapi: '3.1.0', paths: { '/new': {} } })
    const app = createDocumentationApp(load)
    expect(JSON.parse((await request(app, '/openapi.json')).body).paths).toEqual({})
    const invalid = await request(app, '/openapi.json')
    expect(invalid.status).toBe(503)
    expect(JSON.stringify(invalid.body)).not.toContain('private diagnostic')
    expect(JSON.parse((await request(app, '/openapi.json')).body).paths).toEqual({ '/new': {} })
  })

  it('does not expose arbitrary files, business routes or write methods', async () => {
    const app = createDocumentationApp()
    for (const url of ['/.env', '/assets/package.json', '/api/data/full/96', '/ping']) {
      expect((await request(app, url)).status).toBe(404)
    }
    const response = await request(app, '/openapi.json', 'POST')
    expect(response.status).toBe(405)
    expect(response.allow).toBe('GET, HEAD')
  })

  it('chooses a free port by default and accepts only an explicit valid port', () => {
    expect(parseDocumentationPort([])).toBe(0)
    expect(parseDocumentationPort(['--port', '8123'])).toBe(8123)
    const invalidArgs = [
      ['--host', '0.0.0.0'],
      ['--port', '-1'],
      ['--port', '65536'],
      ['--port', '3.5'],
    ]
    for (const args of invalidArgs) {
      expect(() => parseDocumentationPort(args)).toThrow()
    }
  })
})
