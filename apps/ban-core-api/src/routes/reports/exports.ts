import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import

import express, { type Request, type Response } from 'express';
import { logger } from '@ban/tools';

import { handleApiResponse } from '../../helper/handleApiResponse.js';
import { getDataExportStatus } from '../data/exports/status.js';

const app = express.Router();

export const getExportReportRouteHandler = async (req: Request, res: Response) => {
  const { token } = req.params;

  if (typeof token !== 'string' || !token) {
    return handleApiResponse(res, 400, 'Missing export token', {});
  }

  try {
    const exportStatus = await getDataExportStatus(token);

    if (!exportStatus) {
      return handleApiResponse(res, 404, 'Export report not found', {});
    }

    return handleApiResponse(res, 200, 'Export report', exportStatus);
  } catch (error) {
    logger.error('[ban-core-api] Error retrieving export report', error);
    return handleApiResponse(res, 500, 'Internal server error', {});
  }
};

app.get('/exports/:token', getExportReportRouteHandler);

export default app;
