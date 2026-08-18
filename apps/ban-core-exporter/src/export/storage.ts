import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { logger } from '@ban/tools';

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
