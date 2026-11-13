import pg from 'pg';
import { createApp } from './app.js';
import { getTile } from './tiles.js';

const connectionString = process.env.PG_URI || process.env.PG_URL;
if (!connectionString) throw new Error('PG_URI or PG_URL is required');

const pool = new pg.Pool({ connectionString });
const port = Number(process.env.BAN_TILES_PORT || 3002);
const server = createApp(coordinates => getTile(pool, coordinates)).listen(port, () => {
  console.log(`[ban-tiles] Listening on port ${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => { void pool.end(); }));
}