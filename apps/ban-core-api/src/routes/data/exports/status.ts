import { pgPool } from '@ban/api';

import type { DataExportType } from './enqueue.js';

export type DataExportStatus = {
  token: string;
  status: string | null;
  exportType: DataExportType | null;
  count: number | null;
  message: string | null;
  report: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type DataExportStatusRow = {
  id: string;
  status: string | null;
  jobType: string | null;
  count: number | null;
  message: string | null;
  report: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const toDataExportType = (jobType: string | null): DataExportType | null => {
  if (jobType === 'ban' || jobType === 'diff') {
    return jobType;
  }

  return null;
};

const toDataExportStatus = (row: DataExportStatusRow): DataExportStatus => ({
  token: row.id,
  status: row.status,
  exportType: toDataExportType(row.jobType),
  count: row.count,
  message: row.message,
  report: row.report,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const getDataExportStatus = async (
  token: string
): Promise<DataExportStatus | null> => {
  const result = await pgPool.query<DataExportStatusRow>(
    `
      SELECT
        id,
        status,
        "jobType",
        count,
        message,
        report,
        "createdAt",
        "updatedAt"
      FROM ban.job_status
      WHERE id = $1
        AND "dataType" = $2
      LIMIT 1
    `,
    [token, 'export']
  );

  const row = result.rows[0];

  return row ? toDataExportStatus(row) : null;
};
