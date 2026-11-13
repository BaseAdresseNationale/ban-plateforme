import express from 'express';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { parseTileCoordinates, type TileCoordinates } from './coordinates.js';

const gzipAsync = promisify(gzip);

export function createApp(getTile: (coordinates: TileCoordinates) => Promise<Buffer>): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_request, response) => response.json({ status: 'ok' }));
  app.get('/tiles/ban/:z/:x/:y.pbf', async (request, response) => {
    const coordinates = parseTileCoordinates(request.params.z, request.params.x, request.params.y);
    if (!coordinates) {
      response.sendStatus(404);
      return;
    }

    try {
      const tile = await gzipAsync(await getTile(coordinates));
      response.set({ 'Content-Type': 'application/x-protobuf', 'Content-Encoding': 'gzip', 'Access-Control-Allow-Origin': '*' });
      response.send(tile);
    } catch (error) {
      console.error('[ban-tiles] Tile generation failed:', error);
      response.sendStatus(500);
    }
  });
  return app;
}