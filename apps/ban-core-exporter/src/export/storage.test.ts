import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { DeleteObjectCommand, GetObjectCommand, ListMultipartUploadsCommand, S3Client } from '@aws-sdk/client-s3';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getExportFileName } from './file-naming.js';
import { writeChunk } from './helpers/write-chunk.js';

const mocks = vi.hoisted(() => ({
  send: vi.fn(), destroy: vi.fn(), warn: vi.fn(), commands: [] as string[],
  objects: new Map<string, { body: Buffer; metadata: Record<string, string>; etag: string }>(),
  parts: new Map<number, Buffer>(), metadata: {} as Record<string, string>,
  badSize: false, failPart: false, failComplete: false, badMetadata: false, badEtag: false,
  gate: undefined as Promise<void> | undefined,
}));
vi.mock('@aws-sdk/client-s3', async importOriginal => {
  const sdk = await importOriginal<typeof import('@aws-sdk/client-s3')>();
  if (process.env.RUN_S3_STORAGE_TESTS === '1') return sdk;
  return { ...sdk, S3Client: class extends sdk.S3Client {
    send = mocks.send as typeof sdk.S3Client.prototype.send;
    destroy = mocks.destroy;
  } };
});
vi.mock('@ban/tools', async importOriginal => ({
  ...await importOriginal<typeof import('@ban/tools')>(), logger: { warn: mocks.warn },
}));
const { getExportStorageConfig, streamExport } = await import('./storage.js');
const params = { dataTypes: ['address'], departements: ['31'], at: '2026-05-31T22:00:00Z',
  address_ids: null, common_toponym_ids: null, district_ids: null };
const selection = { token: 'job', exportType: 'full' as const, params };
const name = 'full--dep-31--2026-06-01--job.ndjson';
const content = Buffer.from('{"note":"début"}\n{"note":"fin"}\n');
const sha = (body: Buffer) => createHash('sha256').update(body).digest('hex');

const runS3IntegrationTests = process.env.RUN_S3_STORAGE_TESTS === '1';

// Real S3 and fake transports must never share a run: unit tests stay offline by default.
describe.skipIf(runS3IntegrationTests)('streaming export destinations', () => {
  const previousEnv = { ...process.env };
  let directory: string;
  beforeEach(async () => {
    process.env = { ...previousEnv };
    for (const key of Object.keys(process.env)) if (key.startsWith('EXPORT_')) delete process.env[key];
    Object.assign(process.env, { NODE_ENV: 'development', EXPORT_STORAGE: 's3', EXPORT_S3_BUCKET: 'test',
      EXPORT_S3_ENDPOINT: 'http://localhost:9000', EXPORT_S3_REGION: 'us-east-1',
      EXPORT_S3_ACCESS_KEY_ID: 'test', EXPORT_S3_SECRET_ACCESS_KEY: 'test', EXPORT_S3_PREFIX: '/exports/',
      EXPORT_S3_PUBLIC_BASE_URL: 'https://exports.example.test' });
    directory = await mkdtemp(path.join(os.tmpdir(), 'ban-streaming-'));
    process.env.EXPORT_OUTPUT_DIR = path.join(directory, 'exports');
    mocks.send.mockReset(); mocks.destroy.mockReset(); mocks.warn.mockReset();
    mocks.commands = []; mocks.objects.clear(); mocks.parts.clear(); mocks.metadata = {};
    mocks.badSize = false; mocks.failPart = false; mocks.failComplete = false; mocks.badMetadata = false; mocks.badEtag = false; mocks.gate = undefined;
    // Real multipart Upload, fake S3 transport: no network, credentials or database.
    mocks.send.mockImplementation(async command => {
      mocks.commands.push(command.constructor.name);
      const i = command.input;
      switch (command.constructor.name) {
        case 'PutObjectCommand': {
          const body = Buffer.from(i.Body);
          mocks.objects.set(i.Key, { body, metadata: i.Metadata, etag: '"single"' });
          return { ETag: '"single"' };
        }
        case 'CreateMultipartUploadCommand':
          mocks.metadata = i.Metadata; return { UploadId: 'test-upload' };
        case 'UploadPartCommand':
          await mocks.gate;
          if (mocks.failPart) throw new Error('S3 part failed');
          mocks.parts.set(i.PartNumber, Buffer.from(i.Body));
          return { ETag: '"part-' + i.PartNumber + '"' };
        case 'CompleteMultipartUploadCommand': {
          if (mocks.failComplete) throw new Error('S3 completion failed');
          const body = Buffer.concat([...mocks.parts].sort(([a], [b]) => a - b).map(([, b]) => b));
          mocks.objects.set(i.Key, { body, metadata: mocks.metadata, etag: '"multipart-3"' });
          mocks.parts.clear(); return { ETag: '"multipart-3"' };
        }
        case 'HeadObjectCommand': {
          const object = mocks.objects.get(i.Key)!;
          return { ContentLength: object.body.length + (mocks.badSize ? 1 : 0),
            ETag: mocks.badEtag ? '"changed"' : object.etag,
            Metadata: mocks.badMetadata ? {} : object.metadata };
        }
        case 'AbortMultipartUploadCommand':
          mocks.parts.clear(); return {};
        default: throw new Error('Unexpected S3 command');
      }
    });
  });
  afterEach(async () => {
    process.env = previousEnv;
    await rm(directory, { recursive: true, force: true });
  });

  it.each(['local', 's3', 'both'])('selects %s explicitly', storage => {
    process.env.EXPORT_STORAGE = storage;
    expect(getExportStorageConfig().storage).toBe(storage);
  });
  it.each(['s3', 'both'])('rejects incomplete %s configuration', storage => {
    process.env.EXPORT_STORAGE = storage;
    delete process.env.EXPORT_S3_BUCKET;
    expect(getExportStorageConfig).toThrow('Missing S3');
  });
  it('rejects an unknown storage mode', () => {
    process.env.EXPORT_STORAGE = 'unknown';
    expect(getExportStorageConfig).toThrow('Invalid EXPORT_STORAGE');
  });
  it('falls back locally only for unconfigured development, not production', () => {
    delete process.env.EXPORT_STORAGE; delete process.env.EXPORT_S3_BUCKET;
    expect(getExportStorageConfig()).toEqual({ storage: 'local' });
    process.env.NODE_ENV = 'production';
    expect(getExportStorageConfig).toThrow('Missing S3');
  });

  it.each(['local', 's3', 'both'])('writes once to %s with byte counts and full SHA-256', async storage => {
    process.env.EXPORT_STORAGE = storage;
    const produce = vi.fn(async (output, signal) => {
      await writeChunk(output, content.toString(), signal);
      if (storage !== 's3') {
        await vi.waitFor(async () => expect(await readFile(path.join(process.env.EXPORT_OUTPUT_DIR!, name + '.partial'))).toEqual(content));
      }
      return { count: 2 };
    });
    const result = await streamExport(selection, produce);
    expect(produce).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ value: { count: 2 }, output: { storage, size: content.length, sha256: sha(content) } });
    if (storage === 's3') {
      await expect(readdir(process.env.EXPORT_OUTPUT_DIR!)).rejects.toMatchObject({ code: 'ENOENT' });
    } else {
      expect(await readFile(path.join(process.env.EXPORT_OUTPUT_DIR!, name))).toEqual(content);
      expect(await readdir(process.env.EXPORT_OUTPUT_DIR!)).toEqual([name]);
    }
    if (storage === 'local') expect(mocks.send).not.toHaveBeenCalled();
    else {
      expect(result.output).toMatchObject({ key: 'exports/2026-06/' + name, url: 'https://exports.example.test/exports/2026-06/' + name });
      expect(mocks.objects.get('exports/2026-06/' + name)?.body).toEqual(content);
      expect(mocks.destroy).toHaveBeenCalledOnce();
    }
  });

  it('groups a month-crossing DIFF under diff_ plus its exclusive Paris end date', async () => {
    const { output } = await streamExport({ ...selection, exportType: 'diff',
      params: { ...params, at: undefined, from: '2026-05-24T22:00:00Z', to: '2026-05-31T22:00:00Z' } },
    async (out, signal) => { await writeChunk(out, content.toString(), signal); });
    expect(output).toMatchObject({ key: 'exports/2026-06/diff_2026-06-01/diff--dep-31--2026-05-25_2026-06-01--job.ndjson' });
  });

  it('streams multipart bytes identically to both destinations, with a non-MD5 ETag', async () => {
    process.env.EXPORT_STORAGE = 'both';
    const chunk = 'x'.repeat(64 * 1024);
    const { output } = await streamExport(selection, async (out, signal) => {
      for (let i = 0; i < 270; i++) await writeChunk(out, chunk, signal);
    });
    const local = await readFile(path.join(process.env.EXPORT_OUTPUT_DIR!, name));
    expect(mocks.objects.get('exports/2026-06/' + name)?.body.equals(local)).toBe(true);
    expect(output).toMatchObject({ size: 270 * chunk.length, sha256: sha(local), etag: '"multipart-3"' });
    expect(mocks.commands.filter(x => x === 'UploadPartCommand')).toHaveLength(3);
  });

  it('bounds buffering and aborts multipart after failure while backpressured', async () => {
    process.env.EXPORT_STORAGE = 'both';
    let release!: () => void;
    mocks.gate = new Promise<void>(resolve => { release = resolve; });
    let written = 0;
    const run = streamExport(selection, async (out, signal) => {
      for (; written < 1024; written++) await writeChunk(out, 'x'.repeat(64 * 1024), signal);
    });
    // Attach the rejection expectation before releasing the failing upload.
    const rejected = expect(run).rejects.toThrow('S3 part failed');
    await vi.waitFor(() => expect(mocks.commands).toContain('UploadPartCommand'));
    expect(written).toBeLessThan(512); // less than half of a 64 MiB producer buffered
    mocks.failPart = true; release();
    await rejected;
    expect(mocks.commands).toContain('AbortMultipartUploadCommand');
    expect(mocks.parts.size).toBe(0);
    expect(mocks.objects.size).toBe(0);
    expect(await readdir(process.env.EXPORT_OUTPUT_DIR!)).toEqual([name + '.partial']);
  });

  it('aborts multipart when the final S3 completion fails', async () => {
    mocks.failComplete = true;
    await expect(streamExport(selection, async (out, signal) => {
      for (let i = 0; i < 140; i++) await writeChunk(out, 'x'.repeat(64 * 1024), signal);
    })).rejects.toThrow('S3 completion failed');
    expect(mocks.commands).toContain('AbortMultipartUploadCommand');
    expect(mocks.parts.size).toBe(0);
  });

  it('preserves a producer error and retains the incomplete local file', async () => {
    process.env.EXPORT_STORAGE = 'both';
    await expect(streamExport(selection, async (out, signal) => {
      await writeChunk(out, content.toString(), signal);
      throw new Error('SQL failed');
    })).rejects.toThrow('SQL failed');
    expect(await readdir(process.env.EXPORT_OUTPUT_DIR!)).toEqual([name + '.partial']);
    expect(mocks.objects.size).toBe(0);
  });

  it('interrupts a backpressured producer on a local file error', async () => {
    process.env.EXPORT_STORAGE = 'both';
    await mkdir(path.join(process.env.EXPORT_OUTPUT_DIR!, name + '.partial'), { recursive: true });
    await expect(streamExport(selection, async (out, signal) => {
      for (let i = 0; i < 100; i++) await writeChunk(out, 'x'.repeat(64 * 1024), signal);
    })).rejects.toMatchObject({ code: 'EEXIST' });
    expect(mocks.objects.size).toBe(0);
  });

  it.each(['badSize', 'badMetadata', 'badEtag'] as const)('rejects %s before completing a local copy', async issue => {
    process.env.EXPORT_STORAGE = 'both'; mocks[issue] = true;
    await expect(streamExport(selection, async (out, signal) => {
      await writeChunk(out, content.toString(), signal);
    })).rejects.toThrow('S3 export');
    expect(await readdir(process.env.EXPORT_OUTPUT_DIR!)).toEqual([name + '.partial']);
  });

  it('keeps successful local copies in production too', async () => {
    process.env.NODE_ENV = 'production'; process.env.EXPORT_STORAGE = 'both';
    await streamExport(selection, async (out, signal) => { await writeChunk(out, content.toString(), signal); });
    expect(await readFile(path.join(process.env.EXPORT_OUTPUT_DIR!, name))).toEqual(content);
  });

  it('does not overwrite an existing completed local export', async () => {
    process.env.EXPORT_STORAGE = 'local';
    await mkdir(process.env.EXPORT_OUTPUT_DIR!, { recursive: true });
    await writeFile(path.join(process.env.EXPORT_OUTPUT_DIR!, name), 'previous export');
    await expect(streamExport(selection, async (out, signal) => {
      await writeChunk(out, content.toString(), signal);
    })).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await readFile(path.join(process.env.EXPORT_OUTPUT_DIR!, name), 'utf8')).toBe('previous export');
  });
});

// Opt-in only: real writes, restricted to a unique prefix on a loopback S3 endpoint.
describe.skipIf(process.env.RUN_S3_STORAGE_TESTS !== '1')('local S3 streaming', () => {
  const previousEnv = { ...process.env };
  const ownedKeys = new Set<string>();
  let directory: string;
  let client: S3Client;
  let config: Exclude<ReturnType<typeof getExportStorageConfig>, { storage: 'local' }>;
  const params = { dataTypes: ['district'], departements: ['99'], at: '2026-05-31T22:00:00Z',
    address_ids: null, common_toponym_ids: null, district_ids: null };
  const chunk = JSON.stringify({ transportCheck: 'é'.repeat(32 * 1024) }) + '\n';

  beforeAll(async () => {
    process.env.EXPORT_STORAGE = 's3';
    const selected = getExportStorageConfig();
    if (selected.storage === 'local') throw new Error('Configure local S3 credentials first');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(selected.endpoint).hostname)) {
      throw new Error('These tests only write to local S3');
    }
    config = { ...selected, prefix: `exports/_checks/stream-${randomUUID()}` };
    directory = await mkdtemp(path.join(os.tmpdir(), 'ban-streaming-s3-'));
    process.env.EXPORT_OUTPUT_DIR = directory;
    client = new S3Client({ endpoint: config.endpoint, region: config.region, forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  });
  afterAll(async () => {
    // Exact keys created by this run only; never list/delete other exports.
    if (client) {
      for (const Key of ownedKeys) await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key }));
      client.destroy();
    }
    if (directory) await rm(directory, { recursive: true, force: true });
    process.env = previousEnv;
  });

  it.each(['local', 's3', 'both'] as const)('verifies the real %s output byte for byte', async storage => {
    const token = 'transport-' + storage;
    const selection = { token, exportType: 'full' as const, params };
    const key = config.prefix + '/2026-06/' + getExportFileName(token, 'full', params);
    if (storage !== 'local') ownedKeys.add(key);
    const hash = createHash('sha256');
    // More than 16 MiB: both S3 modes must use multiple parts.
    const { output } = await streamExport(selection, async (out, signal) => {
      for (let i = 0; i < 270; i++) { hash.update(chunk); await writeChunk(out, chunk, signal); }
    }, storage === 'local' ? { storage } : { ...config, storage });
    expect(output.size).toBe(270 * Buffer.byteLength(chunk));
    expect(output.sha256).toBe(hash.digest('hex'));
    if (output.storage !== 's3') {
      const local = await readFile(output.path!);
      expect(createHash('sha256').update(local).digest('hex')).toBe(output.sha256);
    } else {
      expect(await readdir(directory)).not.toContain(getExportFileName(token, 'full', params));
    }
    if (output.storage !== 'local') {
      expect(output.key).toBe(key);
      const object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      const downloaded = createHash('sha256');
      for await (const data of object.Body as AsyncIterable<Uint8Array>) downloaded.update(data);
      expect(downloaded.digest('hex')).toBe(output.sha256);
      expect(object.ContentLength).toBe(output.size);
    }
  }, 60_000);

  it('leaves no incomplete multipart upload after a producer failure', async () => {
    const token = 'transport-failure';
    await expect(streamExport({ token, exportType: 'full', params }, async (out, signal) => {
      for (let i = 0; i < 140; i++) await writeChunk(out, chunk, signal);
      // Wait until CreateMultipartUpload really happened before simulating SQL failure.
      let started = false;
      for (let i = 0; i < 30; i++) {
        const pending = await client.send(new ListMultipartUploadsCommand({ Bucket: config.bucket, Prefix: config.prefix }));
        if (pending.Uploads?.length) { started = true; break; }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(started).toBe(true);
      throw new Error('simulated SQL failure');
    }, { ...config, storage: 'both' })).rejects.toThrow('simulated SQL failure');
    const pending = await client.send(new ListMultipartUploadsCommand({ Bucket: config.bucket, Prefix: config.prefix }));
    expect(pending.Uploads ?? []).toHaveLength(0);
    expect(await readdir(directory)).toContain(getExportFileName(token, 'full', params) + '.partial');
  }, 60_000);
});
