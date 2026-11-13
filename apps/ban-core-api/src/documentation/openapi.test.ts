import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { bundleOpenApi, writeOpenApiBundle } from './openapi.js';

const directories: string[] = [];
const fixture = async (contents: string) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ban-openapi-test-'));
  directories.push(directory);
  const source = path.join(directory, 'openapi.yaml');
  await writeFile(source, contents);
  return source;
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true })));
});

describe('OpenAPI assembly', () => {
  it('writes a validated, standalone document with only local fragment references', async () => {
    const source = await fixture('');
    const output = path.join(path.dirname(source), 'generated/openapi.json');
    await writeOpenApiBundle(output);
    const document = JSON.parse(await readFile(output, 'utf8'));
    expect(document.openapi).toBe('3.1.0');
    expect(document.paths['/api/data/full/{dep}']).toBeDefined();
    const references = [...JSON.stringify(document).matchAll(/"\$ref":"([^"]+)"/g)].map(match => match[1]);
    expect(references.length).toBeGreaterThan(0);
    expect(references.every(reference => reference.startsWith('#/'))).toBe(true);
  });

  it('fails on invalid OpenAPI instead of generating a success document', async () => {
    const source = await fixture('openapi: 3.1.0\ninfo: {}\npaths: {}\n');
    await expect(bundleOpenApi(source)).rejects.toThrow();
  });

  it('fails on unresolved file references', async () => {
    const source = await fixture("openapi: 3.1.0\ninfo: { title: Test, version: '1' }\npaths:\n  /missing:\n    $ref: './missing.yaml#/path'\n");
    await expect(bundleOpenApi(source)).rejects.toThrow();
  });

  it('refuses remote references without making an HTTP request', async () => {
    const source = await fixture("openapi: 3.1.0\ninfo: { title: Test, version: '1' }\npaths:\n  /remote:\n    $ref: 'https://example.invalid/remote.yaml'\n");
    await expect(bundleOpenApi(source)).rejects.toThrow();
  });
});
