import { nanoid } from 'nanoid';

import { pgPool } from '@ban/api';

import { publications } from '../../../rabbitmq.config.js';
import { publishRabbitMqMessage } from '../../../rabbitmq.broker.js';

export type DataExportType = 'ban' | 'diff';

export type DataExportRequestParams = {
  format: string;
  dataTypes: string[];
  departements: string[];
  address_ids: string[] | null;
  common_toponym_ids: string[] | null;
  district_ids: string[] | null;
  at?: string | null;
  from?: string | null;
  to?: string | null;
};

export type DataExportRequestMessage = {
  token: string;
  exportType: DataExportType;
  params: DataExportRequestParams;
};

const insertPendingExportStatus = async (message: DataExportRequestMessage) => {
  const now = new Date();

  await pgPool.query(
    `
      INSERT INTO ban.job_status (
        id,
        status,
        "dataType",
        "jobType",
        message,
        report,
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
    `,
    [
      message.token,
      'pending',
      'export',
      message.exportType,
      'Export request accepted',
      JSON.stringify({ params: message.params }),
      now,
      now,
    ]
  );
};

const markExportStatusAsError = async (token: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  await pgPool.query(
    `
      UPDATE ban.job_status
      SET
        status = $2,
        message = $3,
        "updatedAt" = $4
      WHERE id = $1
    `,
    [token, 'error', message, new Date()]
  );
};

export const enqueueDataExportRequest = async (
  exportType: DataExportType,
  params: DataExportRequestParams
) => {
  const message = {
    token: nanoid(),
    exportType,
    params,
  } satisfies DataExportRequestMessage;

  await insertPendingExportStatus(message);

  try {
    await publishRabbitMqMessage(publications.exportRequested, message);
  } catch (error) {
    await markExportStatusAsError(message.token, error);
    throw error;
  }

  return {
    token: message.token,
    exportType: message.exportType,
    status: 'pending' as const,
  };
};
