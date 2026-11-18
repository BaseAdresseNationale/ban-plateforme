import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { link, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { finished } from 'node:stream/promises';

import { AbortMultipartUploadCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

import { BAN_EXPORT_FORMAT, logger } from '@ban/tools';

import { getExportFileName, getExportReferenceDate, getExportReferenceMonth } from './file-naming.js';
import { getExportOutputDir } from './output-directory.js';
import type { DataExportParams, DataExportType, ExportStorageOutput } from './types.js';

type LocalStorageConfig = { storage: 'local' };
type S3StorageConfig = {
  storage: 's3' | 'both';
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
  forcePathStyle: boolean;
  publicBaseUrl?: string;
};
type ExportStorageConfig = LocalStorageConfig | S3StorageConfig;

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

export const getExportStorageConfig = (): ExportStorageConfig => {
  const storage = process.env.EXPORT_STORAGE;
  if (storage && !['local', 's3', 'both'].includes(storage)) throw new Error('Invalid EXPORT_STORAGE: expected local, s3 or both');
  if (storage === 'local') return { storage };
  const bucket = process.env.EXPORT_S3_BUCKET;
  const endpoint = process.env.EXPORT_S3_ENDPOINT;
  const region = process.env.EXPORT_S3_REGION;
  const accessKeyId = process.env.EXPORT_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.EXPORT_S3_SECRET_ACCESS_KEY;
  if (bucket && endpoint && region && accessKeyId && secretAccessKey) return {
    storage: storage === 'both' ? 'both' : 's3', bucket, endpoint, region, accessKeyId, secretAccessKey,
    prefix: trimSlashes(process.env.EXPORT_S3_PREFIX || 'exports'),
    forcePathStyle: process.env.EXPORT_S3_FORCE_PATH_STYLE !== 'false',
    publicBaseUrl: process.env.EXPORT_S3_PUBLIC_BASE_URL,
  };
  if (process.env.NODE_ENV === 'production' || storage === 's3' || storage === 'both') throw new Error('Missing S3 export configuration');
  logger.warn('[ban-core-exporter] Missing S3 export configuration, keeping export file locally');
  return { storage: 'local' };
};

/** One producer, bounded fan-out: every destination acknowledges each chunk. */
export const streamExport = async <T>({ token, exportType, params }: {
  token: string; exportType: DataExportType; params: DataExportParams;
}, produce: (output: Writable, signal: AbortSignal) => Promise<T>, config = getExportStorageConfig()): Promise<{
  value: T; output: ExportStorageOutput;
}> => {
  const name = getExportFileName(token, exportType, params);
  const controller = new AbortController();
  const sinks: Writable[] = [];
  const completions: Promise<void>[] = [];
  const hash = createHash('sha256');
  let size = 0;
  let filePath: string | undefined;
  let client: S3Client | undefined;
  let upload: Upload | undefined;
  let uploadDone: ReturnType<Upload['done']> | undefined;
  let key: string | undefined;

  const output = new Writable({
    highWaterMark: 64 * 1024,
    write(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      hash.update(chunk);
      // Each destination acknowledges the chunk before another is forwarded.
      Promise.all(sinks.map(sink => new Promise<void>((resolve, reject) => {
        sink.write(chunk, error => error ? reject(error) : resolve());
      }))).then(() => callback(), callback);
    },
    final(callback) {
      sinks.forEach(sink => sink.end());
      Promise.all(completions).then(() => callback(), callback);
    },
  });
  const outputDone = finished(output);
  const fail = (error: unknown) => {
    const cause = error instanceof Error ? error : new Error(String(error));
    if (!controller.signal.aborted) controller.abort(cause);
    output.destroy(cause);
    sinks.forEach(sink => sink.destroy(cause));
  };
  // Observe failures even while PostgreSQL is reading or a destination is blocked.
  void outputDone.catch(fail);
  const addSink = (sink: Writable) => {
    sinks.push(sink);
    const completion = finished(sink, { readable: false });
    void completion.catch(fail);
    completions.push(completion);
  };

  try {
    if (config.storage !== 's3') {
      await mkdir(getExportOutputDir(), { recursive: true });
      filePath = path.join(getExportOutputDir(), name);
      addSink(createWriteStream(`${filePath}.partial`, { flags: 'wx' }));
    }
    if (config.storage !== 'local') {
      key = [config.prefix, getExportReferenceMonth(exportType, params),
        ...(exportType === 'diff' ? [`diff_${getExportReferenceDate(exportType, params)}`] : []), name]
        .map(trimSlashes).filter(Boolean).join('/');
      client = new S3Client({ endpoint: config.endpoint, region: config.region, forcePathStyle: config.forcePathStyle,
        maxAttempts: 2, requestHandler: { connectionTimeout: 10_000, requestTimeout: 30_000 },
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
      const body = new PassThrough({ highWaterMark: 64 * 1024 });
      addSink(body);
      upload = new Upload({ client, queueSize: 2, partSize: 8 * 1024 * 1024, leavePartsOnError: false,
        params: { Bucket: config.bucket, Key: key, Body: body, ContentType: 'application/x-ndjson',
          ChecksumAlgorithm: 'SHA256', Metadata: { token, 'export-type': exportType, format: BAN_EXPORT_FORMAT } },
      });
      uploadDone = upload.done();
      void uploadDone.catch(fail);
    }
    controller.signal.throwIfAborted();
    const value = await produce(output, controller.signal);
    controller.signal.throwIfAborted();
    output.end();
    await outputDone;
    const uploaded = await uploadDone;
    controller.signal.throwIfAborted();
    // SDK request checksums protect uploads; this full-stream SHA-256 validates downloads.
    const sha256 = hash.digest('hex');
    if (config.storage !== 'local') {
      const head = await client!.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
      if (head.ContentLength !== size) throw new Error('S3 export size mismatch');
      if (uploaded?.ETag && head.ETag !== uploaded.ETag) throw new Error('S3 export ETag changed after upload');
      for (const [field, expected] of Object.entries({ token, 'export-type': exportType, format: BAN_EXPORT_FORMAT })) {
        if (head.Metadata?.[field] !== expected) throw new Error(`S3 export metadata mismatch: ${field}`);
      }
    }
    // Local files become complete only after all selected destinations succeed.
    if (filePath) {
      // Publish without overwriting a completed file with the same job token.
      await link(`${filePath}.partial`, filePath);
      await unlink(`${filePath}.partial`);
    }
    if (config.storage === 'local') return { value, output: { storage: 'local', path: filePath!, size, sha256 } };
    const remote = { bucket: config.bucket, key: key!, endpoint: config.endpoint, size, sha256,
      ...(uploaded?.ETag ? { etag: uploaded.ETag } : {}),
      ...(config.publicBaseUrl ? { url: `${config.publicBaseUrl.replace(/\/+$/g, '')}/${key}` } : {}),
    };
    return { value, output: config.storage === 'both'
      ? { storage: 'both', ...remote, path: filePath! } : { storage: 's3', ...remote } };
  } catch (error) {
    fail(error);
    // Destroying the body ends the SDK readers; let in-flight parts settle before
    // aborting, so a late UploadPart cannot recreate parts after cleanup.
    await Promise.allSettled([outputDone, ...completions, ...(uploadDone ? [uploadDone] : [])]);
    if (upload?.uploadId && config.storage !== 'local') {
      try {
        await client!.send(new AbortMultipartUploadCommand({ Bucket: config.bucket, Key: key, UploadId: upload.uploadId }));
      } catch (cleanupError) {
        if ((cleanupError as { name?: string }).name !== 'NoSuchUpload') {
          logger.warn('[ban-core-exporter] Multipart cleanup failed; check incomplete uploads', { token, key });
        }
      }
    }
    throw controller.signal.reason ?? error;
  } finally {
    client?.destroy();
  }
};
