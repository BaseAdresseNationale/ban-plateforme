import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

import SwaggerParser from '@apidevtools/swagger-parser'
import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

import { createPostalApp } from './app.js'
import { PostalReferenceError } from './reference-writer.js'

const token = 'f'.repeat(36)
const now = () => new Date('2026-01-01T00:00:00.000Z')

async function request(
  app: ReturnType<typeof createPostalApp>,
  { body = '[]', authorization = `Token ${token}`, type = 'application/json',
    url = '/postal-code/postal-datanova' } = {},
) {
  const req = Object.assign(Readable.from([Buffer.from(body)]), {
    method: 'PUT', url, headers: {
      authorization, 'content-type': type, 'content-length': String(Buffer.byteLength(body)),
    },
  }) as unknown as Request
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const headers = new Map<string, string>()
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
      getHeader: (name: string) => headers.get(name.toLowerCase()),
      removeHeader: (name: string) => headers.delete(name.toLowerCase()),
      end(this: Response, value?: string | Buffer) {
        resolve({ status: this.statusCode, body: value ? JSON.parse(value.toString()) : {} })
      },
    }) as unknown as Response
    app(req, res, (error?: unknown) => {
      if (error) reject(error)
      else resolve({ status: 404, body: {} })
    })
  })
}

describe('postal administration HTTP contract', () => {
  const setup = () => {
    const datanova = vi.fn().mockResolvedValue([{ inseeCom: '96001', updatedRowsCount: 1 }])
    const app = createPostalApp({ lookup: vi.fn(), tokens: [token], now,
      administration: { datanova } })
    return { app, datanova }
  }

  it('is absent unless explicitly installed', async () => {
    const app = createPostalApp({ lookup: vi.fn(), tokens: [token] })
    expect((await request(app)).status).toBe(404)
  })

  it('authenticates before parsing even malformed or oversized bodies', async () => {
    const { app, datanova } = setup()
    for (const body of ['{broken', 'x'.repeat(2_100_000)]) {
      expect((await request(app, { body, authorization: '' })).status).toBe(401)
    }
    expect(datanova).not.toHaveBeenCalled()
  })

  it('preserves the success envelope and passes only the decoded body', async () => {
    const { app, datanova } = setup()
    expect(await request(app)).toEqual({ status: 200, body: {
      date: now().toISOString(), status: 'success',
      message: 'Records updated successfully', response: { totalUpdated: 1 },
    } })
    expect(datanova).toHaveBeenCalledExactlyOnceWith([])
  })

  it('reports existing-row partial results as 207, rather than a false full success', async () => {
    const { app, datanova } = setup()
    const failed = { inseeCom: '96002', updatedRowsCount: 0 }
    datanova.mockResolvedValue([
      { inseeCom: '96001', updatedRowsCount: 1 }, failed,
    ])
    expect(await request(app)).toMatchObject({ status: 207, body: {
      response: { totalUpdated: 1, failedUpdates: [failed] },
    } })
  })

  it.each([
    { body: '{broken', status: 400 },
    { body: 'x'.repeat(2_100_000), status: 413 },
    { type: 'text/plain', status: 415 },
    { url: '/postal-code/postal-datanova?unexpected=1', status: 400 },
  ])('rejects invalid HTTP bodies or parameters before writing %#', async testCase => {
    const { status, ...input } = testCase
    const { app, datanova } = setup()
    expect((await request(app, input)).status).toBe(status)
    expect(datanova).not.toHaveBeenCalled()
  })

  it.each([
    { error: new PostalReferenceError('invalid-reference', 'private input'), status: 400 },
    { error: new PostalReferenceError('storage', 'private SQL'), status: 503 },
    { error: new PostalReferenceError('publication-unknown', 'private connection'), status: 503 },
    { error: new Error('private SQL'), status: 503 },
  ])('sanitizes failures and never returns success %#', async ({ error, status }) => {
    const { app, datanova } = setup()
    datanova.mockRejectedValue(error)
    const response = await request(app)
    expect(response.status).toBe(status)
    expect(response.body.status).toBe('error')
    expect(JSON.stringify(response.body)).not.toContain('private')
  })

  it('documents the mounted write operation, token, body and response codes', async () => {
    const document = await SwaggerParser.validate(fileURLToPath(new URL('../openapi.yaml',
      import.meta.url)), { resolve: { http: false } })
    const operation = document.paths?.['/postal-code/postal-datanova']?.put
    expect(operation?.security).toEqual([{ PostalToken: [] }])
    expect(operation).toHaveProperty('requestBody.required', true)
    expect(Object.keys(operation?.responses ?? {}).sort())
      .toEqual(['200', '207', '400', '401', '413', '415', '503'])
  })
})
