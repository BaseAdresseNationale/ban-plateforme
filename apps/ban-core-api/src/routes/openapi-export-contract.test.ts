import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import SwaggerParser from '@apidevtools/swagger-parser';

import { bundleOpenApi } from '../documentation/openapi.js';

// Contrat transversal : montages Express, document assemblé et schémas d'exports.
// Les assertions textuelles historiques sont conservées sur le contenu de famille.
const rootDir = path.resolve(import.meta.dirname, '../..');
const openApiPath = path.join(rootDir, 'src/routes/data/exports/openapi.yaml');
const apiIndexPath = path.join(rootDir, 'src/index.ts');
const exportReportRoutePath = path.join(rootDir, 'src/routes/reports/exports.ts');

const readContractFiles = async () => {
  const [openApi, apiIndex, exportReportRoute] = await Promise.all([
    readFile(openApiPath, 'utf8'),
    readFile(apiIndexPath, 'utf8'),
    readFile(exportReportRoutePath, 'utf8'),
  ]);

  return {
    openApi,
    apiIndex,
    exportReportRoute,
  };
};

const expectPathDocumented = (openApi: string, pathName: string) => {
  expect(openApi).toContain(`  ${pathName}:`);
  expect(openApi).toContain('    get:');
};

// Tests
// -----
describe('OpenAPI export contract', () => {
  it('preserves the three export operations and schemas after resolving family references', async () => {
    const bundled = await bundleOpenApi();
    const resolved = await SwaggerParser.dereference(structuredClone(bundled), { resolve: { http: false } });
    const parser = new SwaggerParser();
    await parser.resolve(path.join(rootDir, 'openapi.yaml'), { resolve: { http: false } });
    const family = parser.$refs.get(openApiPath) as Record<string, unknown>;
    const expected = await SwaggerParser.dereference({
      openapi: '3.1.0', info: { title: 'Exports', version: 'test' }, paths: {}, components: {}, ...family,
    }, { resolve: { http: false } });
    for (const pathName of ['/api/data/full/{dep}', '/api/data/diff/{dep}', '/api/reports/exports/{token}']) {
      expect(resolved.paths?.[pathName]).toEqual(expected.paths?.[pathName]);
    }
    expect('components' in resolved ? resolved.components : undefined)
      .toEqual('components' in expected ? expected.components : undefined);
  });
  it('documents the async export request routes', async () => {
    const { openApi } = await readContractFiles();

    expectPathDocumented(openApi, '/api/data/full/{dep}');
    expectPathDocumented(openApi, '/api/data/diff/{dep}');

    expect(openApi).toContain('summary: Demander un export FULL asynchrone');
    expect(openApi).toContain('summary: Demander un export differentiel asynchrone');
    expect(openApi).toContain("'202':");
    expect(openApi).toContain("$ref: '#/components/schemas/AsyncExportAcceptedResponse'");
    expect(openApi).toContain('exportType: full');
    expect(openApi).toContain('exportType: diff');
    expect(openApi).toContain('- pending');
  });

  it('documents the export report route mounted by Express', async () => {
    const { openApi, apiIndex, exportReportRoute } = await readContractFiles();

    expect(apiIndex).toContain("app.use('/api/reports', reportRoutes)");
    expect(exportReportRoute).toContain("app.get('/exports/:token', getExportReportRouteHandler)");

    expectPathDocumented(openApi, '/api/reports/exports/{token}');
    expect(openApi).not.toContain('/api/data/exports/{token}');
    expect(openApi).toContain("summary: Consulter le rapport d'une demande d'export");
    expect(openApi).toContain("'200':");
    expect(openApi).toContain("'404':");
    expect(openApi).toContain("$ref: '#/components/schemas/AsyncExportStatusResponse'");
  });

  it('documents the export report statuses and output payload', async () => {
    const { openApi } = await readContractFiles();

    for (const status of ['pending', 'processing', 'success', 'error']) {
      expect(openApi).toContain(`- ${status}`);
    }

    for (const property of [
      'token:',
      'exportType:',
      'count:',
      'message:',
      'report:',
      'createdAt:',
      'updatedAt:',
      'storage: s3',
      'bucket: ban-exports',
    ]) {
      expect(openApi).toContain(property);
    }
  });
});
