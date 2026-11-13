import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';

import SwaggerParser from '@apidevtools/swagger-parser';
import express, { type Request, type Response } from 'express';
import { describe, expect, it } from 'vitest';

import { bundleOpenApi } from '../../documentation/openapi.js';
import healthRoutes from './index.js';

// Requêtes passées au vrai routeur et à la vraie sérialisation Express,
// sans démarrer index.ts, ouvrir un socket ou charger une configuration métier.
async function request(url: string, method = 'GET') {
  const app = express();
  app.use('/', healthRoutes);
  return new Promise<{ status: number; body: string; type?: string }>((resolve, reject) => {
    const req = Object.assign(new EventEmitter(), { url, method, headers: {} }) as Request;
    const headers = new Map<string, string>();
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
      getHeader: (name: string) => headers.get(name.toLowerCase()),
      removeHeader: (name: string) => headers.delete(name.toLowerCase()),
      end(this: Response, body?: Buffer | string) {
        resolve({ status: this.statusCode, body: body?.toString() ?? '', type: headers.get('content-type') });
      },
    }) as unknown as Response;
    app(req, res, (error?: unknown) => { if (error) reject(error); else resolve({ status: 404, body: '' }); });
  });
}

describe('health router', () => {
  it('returns the historical ping status, body and content type without services', async () => {
    expect(await request('/ping')).toEqual({
      status: 200, body: 'pong', type: 'text/html; charset=utf-8',
    });
    expect(await request('/ping', 'HEAD')).toEqual({
      status: 200, body: '', type: 'text/html; charset=utf-8',
    });
  });

  it('does not accept mutation methods or unknown paths', async () => {
    for (const url of ['/ping', '/health']) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        expect((await request(url, method)).status).toBe(404);
      }
    }
    expect((await request('/missing')).status).toBe(404);
  });

  it('matches the documented ping response and mounts the router at the application root', async () => {
    const document = await SwaggerParser.dereference(await bundleOpenApi(), { resolve: { http: false } });
    const operation = document.paths?.['/ping']?.get;
    expect(operation?.security).toEqual([]);
    expect(operation?.tags).toEqual(['Santé']);
    expect(operation?.responses?.['200']).toMatchObject({
      content: { 'text/html': { schema: { type: 'string', const: (await request('/ping')).body }, example: 'pong' } },
    });
    const index = await readFile(new URL('../../index.ts', import.meta.url), 'utf8');
    expect(index).toContain("import healthRoutes from './routes/health/index.js'");
    expect(index).toContain("app.use('/', healthRoutes)");
    expect(index).not.toContain("app.get('/ping'");
  });

  it('preserves the existing JSON health response without checking services', async () => {
    expect(await request('/health')).toEqual({
      status: 200, body: '{"status":"ok"}', type: 'application/json; charset=utf-8',
    });
    expect(await request('/health', 'HEAD')).toEqual({
      status: 200, body: '', type: 'application/json; charset=utf-8',
    });
  });

  it('documents the exact health response and removes the old duplicate handler', async () => {
    const document = await SwaggerParser.dereference(await bundleOpenApi(), { resolve: { http: false } });
    const operation = document.paths?.['/health']?.get;
    expect(operation?.security).toEqual([]);
    expect(operation?.tags).toEqual(['Santé']);
    expect(operation?.responses?.['200']).toMatchObject({
      content: { 'application/json': {
        schema: { type: 'object', additionalProperties: false, required: ['status'], properties: { status: { type: 'string', const: 'ok' } } },
        example: JSON.parse((await request('/health')).body),
      } },
    });
    const index = await readFile(new URL('../../index.ts', import.meta.url), 'utf8');
    expect(index).not.toContain("app.get('/health'");
  });
});
