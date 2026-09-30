import { createReadStream } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { logger } from '@ban/tools';

import { getExportOutputDir } from './output-directory.js';
import type {
  DataExportParams,
  DataExportType,
  ExportStorageOutput,
} from './types.js';

type LocalStorageConfig = {
  storage: 'local';
};

type S3StorageConfig = {
  storage: 's3';
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
  if (process.env.EXPORT_STORAGE === 'local') {
    return { storage: 'local' };
  }

  const bucket = process.env.EXPORT_S3_BUCKET;
  const endpoint = process.env.EXPORT_S3_ENDPOINT;
  const region = process.env.EXPORT_S3_REGION;
  const accessKeyId = process.env.EXPORT_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.EXPORT_S3_SECRET_ACCESS_KEY;

  if (bucket && endpoint && region && accessKeyId && secretAccessKey) {
    return {
      storage: 's3',
      bucket,
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
      prefix: trimSlashes(process.env.EXPORT_S3_PREFIX || 'exports'),
      forcePathStyle: process.env.EXPORT_S3_FORCE_PATH_STYLE !== 'false',
      publicBaseUrl: process.env.EXPORT_S3_PUBLIC_BASE_URL,
    };
  }

  if (process.env.NODE_ENV === 'production' || process.env.EXPORT_STORAGE === 's3') {
    throw new Error('Missing S3 export configuration');
  }

  logger.warn('[ban-core-exporter] Missing S3 export configuration, keeping export file locally');

  return { storage: 'local' };
};

const createS3Client = (config: S3StorageConfig) => new S3Client({
  endpoint: config.endpoint,
  region: config.region,
  forcePathStyle: config.forcePathStyle,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
});

const getExportObjectKey = ({
  prefix,
  token,
  exportType,
  filePath,
}: {
  prefix: string;
  token: string;
  exportType: DataExportType;
  filePath: string;
}) => {
  const fileName = path.basename(filePath);
  const basePath = [prefix, exportType, token]
    .map(trimSlashes)
    .filter(Boolean)
    .join('/');

  return `${basePath}/${fileName}`;
};

const getPublicUrl = (publicBaseUrl: string | undefined, key: string) => {
  if (!publicBaseUrl) {
    return undefined;
  }

  return `${publicBaseUrl.replace(/\/+$/g, '')}/${key}`;
};

export const storeExportFile = async ({
  token,
  exportType,
  params,
  filePath,
}: {
  token: string;
  exportType: DataExportType;
  params: DataExportParams;
  filePath: string;
}): Promise<ExportStorageOutput> => {
  const config = getExportStorageConfig();

  if (config.storage === 'local') {
    return {
      storage: 'local',
      path: filePath,
    };
  }

  const { size } = await stat(filePath);
  const key = getExportObjectKey({
    prefix: config.prefix,
    token,
    exportType,
    filePath,
  });
  const client = createS3Client(config);

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentLength: size,
    ContentType: 'application/x-ndjson',
    Metadata: {
      token,
      'export-type': exportType,
      format: params.format,
    },
  }));

  return {
    storage: 's3',
    bucket: config.bucket,
    key,
    endpoint: config.endpoint,
    url: getPublicUrl(config.publicBaseUrl, key),
    size,
  };
};

/** Removes the local temporary file after its S3 upload has been confirmed. */
export const removeLocalExportFile = async (filePath: string) => {
  await rm(filePath, { force: true });
};

const getTemporaryFileMaxAgeMs = () => {
  const configuredHours = Number(process.env.EXPORT_TEMP_FILE_MAX_AGE_HOURS);
  const hours = Number.isFinite(configuredHours) && configuredHours > 0 ? configuredHours : 24;
  return hours * 60 * 60 * 1000;
};

/** Removes stale NDJSON files left behind after a pod crash, only in S3 mode. */
export const cleanupStaleS3ExportFiles = async () => {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (getExportStorageConfig().storage !== 's3') {
    return;
  }

  const outputDirectory = getExportOutputDir();
  const cutoff = Date.now() - getTemporaryFileMaxAgeMs();

  try {
    const entries = await readdir(outputDirectory, { withFileTypes: true });
    const staleFiles = await Promise.all(entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.ndjson'))
      .map(async entry => {
        const filePath = path.join(outputDirectory, entry.name);
        return (await stat(filePath)).mtimeMs < cutoff ? filePath : null;
      })
    );

    const filesToRemove = staleFiles.filter((filePath): filePath is string => filePath !== null);
    await Promise.all(filesToRemove.map(removeLocalExportFile));

    if (filesToRemove.length > 0) {
      logger.info('[ban-core-exporter] Fichiers temporaires obsoletes supprimes', {
        count: filesToRemove.length,
        outputDirectory,
      });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn('[ban-core-exporter] Impossible de nettoyer les fichiers temporaires', { error });
    }
  }
};
