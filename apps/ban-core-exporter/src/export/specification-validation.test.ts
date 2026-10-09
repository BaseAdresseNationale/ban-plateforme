import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const specificationDirectory = path.resolve(process.cwd(), 'specifications/ban-diff/v0.4');
const schemasDirectory = path.join(specificationDirectory, 'schemas');
const fixturesDirectory = path.join(specificationDirectory, 'fixtures');
const validatorPath = path.join(specificationDirectory, 'scripts/validate-ban-ndjson.mjs');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const readJson = (filePath: string) => JSON.parse(readFileSync(filePath, 'utf8')) as object;
const readNdjson = (filePath: string) => readFileSync(filePath, 'utf8')
  .trim()
  .split(/\r?\n/)
  .map(line => JSON.parse(line));

const validateFixtureSchema = (schemaFile: string, definitionsFile: string, fixtureFile: string) => {
  const ajv = new Ajv2020({
    strict: false,
    formats: {
      'date-time': value => typeof value === 'string' && !Number.isNaN(Date.parse(value)),
      uuid: value => typeof value === 'string' && uuidPattern.test(value),
    },
  });
  ajv.addSchema(readJson(path.join(schemasDirectory, definitionsFile)));
  const validate = ajv.compile(readJson(path.join(schemasDirectory, schemaFile)));

  for (const line of readNdjson(path.join(fixturesDirectory, fixtureFile))) {
    expect(validate(line), ajv.errorsText(validate.errors)).toBe(true);
  }
};

const runStreamValidator = (fixturePath: string) => spawnSync(process.execPath, [validatorPath, fixturePath], {
  encoding: 'utf8',
});

describe('BAN DIFF v0.4 specification artifacts', () => {
  it.each([
    ['ban-raw-full-v0.4.schema.json', 'ban-raw-definitions-v0.4.schema.json', 'ban-raw-full-v0.4.ndjson'],
    ['ban-raw-diff-v0.4.schema.json', 'ban-raw-definitions-v0.4.schema.json', 'ban-raw-diff-v0.4.ndjson'],
    ['ban-standard-fr-full-v0.4.schema.json', 'ban-standard-fr-definitions-v0.4.schema.json', 'ban-standard-fr-full-v0.4.ndjson'],
    ['ban-standard-fr-diff-v0.4.schema.json', 'ban-standard-fr-definitions-v0.4.schema.json', 'ban-standard-fr-diff-v0.4.ndjson'],
  ])('accepts every line in %s fixtures', (schemaFile, definitionsFile, fixtureFile) => {
    validateFixtureSchema(schemaFile, definitionsFile, fixtureFile);
  });

  it.each([
    'ban-raw-full-v0.4.ndjson',
    'ban-raw-diff-v0.4.ndjson',
    'ban-standard-fr-full-v0.4.ndjson',
    'ban-standard-fr-diff-v0.4.ndjson',
  ])('accepts the valid stream fixture %s', fixtureFile => {
    const result = runStreamValidator(path.join(fixturesDirectory, fixtureFile));
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    'raw-diff-disabled-active.ndjson',
    'raw-diff-updated-single-state.ndjson',
    'raw-full-address-mismatch.ndjson',
    'standard-fr-diff-invalid-period.ndjson',
  ])('rejects the invalid stream fixture %s', fixtureFile => {
    const result = runStreamValidator(path.join(fixturesDirectory, 'invalid', fixtureFile));
    expect(result.status).not.toBe(0);
  });
});
