import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import

import express from 'express'
import { logger } from '@ban/tools';

import { handleApiResponse } from '../../../helper/handleApiResponse.js'
import { fullRequestConfigs as requestConfig } from './full-config.js'
import { enqueueDataExportRequest } from '../exports/enqueue.js'
import { getFullExportRequestParams } from '../exports/request.js'

const app = express.Router()

app.get("/:dep", async (req, res) => {
  const parsedRequest = getFullExportRequestParams(req, requestConfig);

  if (!parsedRequest.ok) {
    return handleApiResponse(res, parsedRequest.status, parsedRequest.message, {});
  }

  try {
    const exportRequest = await enqueueDataExportRequest('full', parsedRequest.params);

    logger.info('[ban-core-api] Demande d\'export FULL envoyee', exportRequest);
    return handleApiResponse(res, 202, 'Export request accepted', exportRequest);
  } catch (error) {
    logger.error('[ban-core-api] Error enqueueing FULL export request', error);
    return handleApiResponse(res, 500, 'Internal server error', {});
  }
});

export default app
