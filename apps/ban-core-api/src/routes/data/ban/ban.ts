import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import

import express from 'express'
import { logger } from '@ban/tools';

import { handleApiResponse } from '../../../helper/handleApiResponse.js'
import { banRequestConfigs as requestConfig } from './ban-config.js'
import { enqueueDataExportRequest } from '../exports/enqueue.js'
import { getBanExportRequestParams } from '../exports/request.js'

const app = express.Router()

app.get("/:dep", async (req, res) => {
  const parsedRequest = getBanExportRequestParams(req, requestConfig);

  if (!parsedRequest.ok) {
    return handleApiResponse(res, parsedRequest.status, parsedRequest.message, {});
  }

  try {
    const exportRequest = await enqueueDataExportRequest('ban', parsedRequest.params);

    logger.info('[ban-core-api] Demande d\'export BAN envoyee', exportRequest);
    return handleApiResponse(res, 202, 'Export request accepted', exportRequest);
  } catch (error) {
    logger.error('[ban-core-api] Error enqueueing BAN export request', error);
    return handleApiResponse(res, 500, 'Internal server error', {});
  }
});

export default app
