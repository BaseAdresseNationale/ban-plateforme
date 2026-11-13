import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from './app.js';

let server: Server | undefined;
afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  server = undefined;
});

async function request(path: string, getTile: ReturnType<typeof vi.fn>) {
  server = createApp(getTile).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No listening address');
  return fetch(`http://127.0.0.1:${address.port}${path}`);
}

describe('tile HTTP endpoint', () => {
  it('serves a compressed protobuf tile', async () => {
    const getTile = vi.fn().mockResolvedValue(Buffer.from('tile'));
    const response = await request('/tiles/ban/10/512/340.pbf', getTile);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/x-protobuf');
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('tile');
    expect(getTile).toHaveBeenCalledWith({ z: 10, x: 512, y: 340 });
  });

  it('rejects invalid coordinates before querying', async () => {
    const getTile = vi.fn();
    expect((await request('/tiles/ban/10/1024/0.pbf', getTile)).status).toBe(404);
    expect(getTile).not.toHaveBeenCalled();
  });

  it('reports database errors', async () => {
    const getTile = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await request('/tiles/ban/10/512/340.pbf', getTile)).status).toBe(500);
    log.mockRestore();
  });
});