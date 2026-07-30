import { pool as pgPool } from '@ban/prisma-client';

export const markExportProcessing = async (token: string) => {
  await pgPool.query(
    `
      UPDATE ban.job_status
      SET
        status = $2,
        message = $3,
        "updatedAt" = $4
      WHERE id = $1
    `,
    [token, 'processing', 'Export processing started', new Date()]
  );
};

export const markExportSuccess = async (
  token: string,
  report: Record<string, unknown>,
  count: number
) => {
  await pgPool.query(
    `
      UPDATE ban.job_status
      SET
        status = $2,
        count = $3,
        message = $4,
        report = $5::jsonb,
        "updatedAt" = $6
      WHERE id = $1
    `,
    [
      token,
      'success',
      count,
      'Export file generated',
      JSON.stringify(report),
      new Date(),
    ]
  );
};

export const markExportError = async (
  token: string,
  error: unknown,
  report: Record<string, unknown> = {}
) => {
  const message = error instanceof Error ? error.message : String(error);

  await pgPool.query(
    `
      UPDATE ban.job_status
      SET
        status = $2,
        message = $3,
        report = $4::jsonb,
        "updatedAt" = $5
      WHERE id = $1
    `,
    [
      token,
      'error',
      message,
      JSON.stringify({ ...report, error: message }),
      new Date(),
    ]
  );
};
