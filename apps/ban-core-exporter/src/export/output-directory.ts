import path from 'node:path';

export const getExportOutputDir = () => path.resolve(
  process.env.EXPORT_OUTPUT_DIR || path.join(process.cwd(), 'tmp/exports')
);
