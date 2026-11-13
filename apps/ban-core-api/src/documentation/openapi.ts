import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import SwaggerParser from '@apidevtools/swagger-parser';

export const apiDirectory = fileURLToPath(new URL('../../', import.meta.url));
export const openApiPath = path.join(apiDirectory, 'openapi.yaml');

// Les références HTTP sont désactivées : la documentation se construit hors ligne.
export async function bundleOpenApi(source = openApiPath) {
  const document = await SwaggerParser.bundle(source, { resolve: { http: false } });
  await SwaggerParser.validate(structuredClone(document), { resolve: { http: false } });
  return document;
}

export async function writeOpenApiBundle(output = path.join(apiDirectory, 'dist/docs/openapi.json')) {
  const document = await bundleOpenApi();
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(document, null, 2)}\n`);
  return output;
}

async function main() {
  switch (process.argv[2]) {
    case 'check': {
      const document = await bundleOpenApi();
      console.log(`OpenAPI valide : ${Object.keys(document.paths ?? {}).length} chemins documentés.`);
      break;
    }
    case 'build':
      console.log(`OpenAPI assemblé : ${await writeOpenApiBundle()}`);
      break;
    default:
      throw new Error('Usage : openapi.ts check|build');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Échec OpenAPI');
    process.exitCode = 1;
  });
}
