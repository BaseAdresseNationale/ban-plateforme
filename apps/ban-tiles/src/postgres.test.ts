import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { describe, expect, it } from 'vitest';
import { getTile } from './tiles.js';

const integration = process.env.RUN_BAN_TILES_POSTGRES_TESTS === '1' ? describe : describe.skip;

integration('PostGIS tiles', () => {
  it('indexes valid active points and returns both decoded MVT layers', async () => {
    const connectionString = process.env.BAN_TILES_TEST_PG_URI;
    if (!connectionString) throw new Error('BAN_TILES_TEST_PG_URI is required');
    const database = `ban_tiles_test_${randomUUID().replaceAll('-', '')}`;
    const adminUrl = new URL(connectionString);
    adminUrl.pathname = '/postgres';
    const admin = new pg.Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    let created = false;
    let pool: pg.Pool | undefined;
    try {
      await admin.query(`CREATE DATABASE "${database}"`);
      created = true;
      const testUrl = new URL(connectionString);
      testUrl.pathname = `/${database}`;
      pool = new pg.Pool({ connectionString: testUrl.toString() });
      await pool.query(`
        CREATE EXTENSION postgis;
        CREATE SCHEMA ban;
        CREATE TABLE ban.district (id uuid PRIMARY KEY, labels jsonb[], meta jsonb, "isActive" boolean);
        CREATE TABLE ban.common_toponym (id uuid PRIMARY KEY, "districtID" uuid, labels jsonb[], geometry jsonb, meta jsonb, "updateDate" timestamptz, "isActive" boolean);
        CREATE TABLE ban.address (id uuid PRIMARY KEY, "districtID" uuid, "mainCommonToponymID" uuid, labels jsonb[], positions jsonb[], number integer, suffix text, certified boolean, meta jsonb, "updateDate" timestamptz, "isActive" boolean);
      `);
      const migration = await readFile(new URL('../../../packages/prisma-client/prisma/migrations/0007_add_tile_spatial_indexes/migration.sql', import.meta.url), 'utf8');
      await pool.query(migration);
      await pool.query(`
        INSERT INTO ban.district VALUES ('11111111-1111-4111-8111-111111111111', ARRAY['{"isoCode":"fra","value":"Paris"}'::jsonb], '{"insee":{"cog":"75056"}}', true);
        INSERT INTO ban.common_toponym VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', ARRAY['{"isoCode":"fra","value":"Rue de la Paix"}'::jsonb], '{"type":"Point","coordinates":[2.35,48.85]}', '{}', NULL, true);
        INSERT INTO ban.address VALUES
          ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', ARRAY[]::jsonb[], ARRAY['{"geometry":{"type":"Point","coordinates":[2.35,48.85]}}'::jsonb], 12, NULL, true, '{"ban":{"DEPRECATED_cleInterop":"75056_0001_00012"}}', NULL, true),
          ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', ARRAY[]::jsonb[], ARRAY['{"geometry":{"type":"Point","coordinates":[2.35,48.85]}}'::jsonb], 13, NULL, false, '{}', NULL, false),
          ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', ARRAY[]::jsonb[], ARRAY['{"geometry":{"type":"Point","coordinates":["invalid",48.85]}}'::jsonb], 14, NULL, false, '{}', NULL, true);
      `);
          await pool.query('SET enable_seqscan = off');
          const addressPlan = await pool.query(`EXPLAIN SELECT id FROM ban.address WHERE "isActive" AND ban.tile_point(positions[1]->'geometry') && ST_Transform(ST_TileEnvelope(10, 518, 352), 4326)`);
          const toponymPlan = await pool.query(`EXPLAIN SELECT id FROM ban.common_toponym WHERE "isActive" AND ban.tile_point(geometry) && ST_Transform(ST_TileEnvelope(10, 518, 352), 4326)`);
          expect(JSON.stringify(addressPlan.rows)).toContain('address_tile_point_idx');
          expect(JSON.stringify(toponymPlan.rows)).toContain('common_toponym_tile_point_idx');
      const tile = new VectorTile(new PbfReader(await getTile(pool, { z: 10, x: 518, y: 352 })));
      expect(Object.keys(tile.layers).sort()).toEqual(['adresses', 'toponymes']);
      expect(tile.layers.adresses.length).toBe(1);
      expect(tile.layers.adresses.feature(0).properties).toMatchObject({ id: '75056_0001_00012', numero: 12, nomVoie: 'Rue de la Paix', codeCommune: '75056', certifie: true });
      expect(tile.layers.toponymes.feature(0).properties).toMatchObject({ nomVoie: 'Rue de la Paix', nbNumeros: 2 });
      expect((await getTile(pool, { z: 10, x: 0, y: 0 })).length).toBe(0);
    } finally {
      if (pool) await pool.end();
      if (created) await admin.query(`DROP DATABASE "${database}"`);
      await admin.end();
    }
  }, 30000);
});