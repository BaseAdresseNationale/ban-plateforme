import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import

import express from 'express'
import Cursor from "pg-cursor";

import { pgPool } from '@ban/api';
import { logger } from '@ban/tools';

import { handleApiResponse } from '../../helper/handleApiResponse.js'
import { banRequestConfigs as requestConfig } from './ban-config.js'
import {
  VALID_FORMATS,
  VALID_DATA_TYPES,
  dateStringToPgTimestamptz,
  getQueryParams,
  getMetaLine,
  banToStandardFr,
  banToStandardFrInt,
  getSnapshotObjLine,
  closeCursor,
  streamCursorData,
} from './helper.js'

const FETCH_SIZE = 500;

const app = express.Router()
const pool = pgPool

app.get("/:dep", async (req, res) => {
  const departements: string[] | null = String(req.params.dep || req.query.deps || "")
    .split(",")
    .filter(Boolean)
    .map(dep => dep.trim());
  const address_ids: string[] | null = null;
  const common_toponym_ids: string[] | null = null;
  const district_ids: string[] | null = null;
  const at: string | null = dateStringToPgTimestamptz(req.query.at as string | undefined);
  const queryFormat: string | null = String(typeof req.query.format === "string" ? req.query.format : "raw");
  const queryDataTypes: string | undefined = req.query.dataTypes ? String(req.query.dataTypes) : undefined;

  // Check department parameter
  // TODO : vérifier que les départements sont valides (ex: regex pour vérifier que ce sont des codes départements valides, ou vérifier dans une liste de départements)
  if (departements.length === 0) return handleApiResponse(res, 400, "The `deps` parameter is required.", {});

  // Check date parameters format
  if(!at)   return handleApiResponse(res, 400, "The `at` parameter is required.", {});
  if(at === 'Invalid date')   return handleApiResponse(res, 400, "Invalid date format for 'at' parameter. Expected ISO 8601 format (YYYY-MM-DD).", {});

  // Validate format parameter
  const format = !queryFormat
    ? 'raw'
    : VALID_FORMATS.includes(queryFormat)
      ? queryFormat
      : undefined;
  if (!format) {
    return handleApiResponse(res, 400, `Invalid 'format' value: ${queryFormat} (available values: ${VALID_FORMATS.join(", ")})`, {});
  }

  // Validate dataTypes parameter
  if (queryDataTypes) {
    const requestedDataTypes = queryDataTypes.split(",").map(item => item.trim());
    if (requestedDataTypes.some(dt => !VALID_DATA_TYPES.includes(dt))) {
      return handleApiResponse(res, 400, `Invalid 'dataTypes' value: ${queryDataTypes} (available values: ${VALID_DATA_TYPES.join(", ")})`, {});
    }
  }

  let activeCursor: Cursor | null = null;
  let aborted = false;
  const client = await pool.connect();
  const abort = async () => {
    aborted = true;
    await closeCursor(activeCursor as Cursor);
    try { client.release(); } catch {}
  };

  try {
    const fetchSize = FETCH_SIZE;
    const dataTypes = queryDataTypes
      ? (queryDataTypes.split(",")
          .map(item => item.trim())
          .filter(item => VALID_DATA_TYPES.includes(item)) as Array<keyof typeof requestConfig>)
      : (Object.keys(requestConfig) as Array<keyof typeof requestConfig>);
    const requestInfo = {
      at,
      format,
      address_ids,
      common_toponym_ids,
      district_ids,
      departements,
      dataTypes,
    };

    req.on("close", abort);
    req.on("aborted", abort);

    // Set response headers for NDJSON streaming
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    // Init the stream with a meta line to indicate the start
    res.write(getMetaLine('stream-start', requestInfo));

    const countEntriesByTypes: Record<keyof typeof requestConfig, number> = {} as Record<keyof typeof requestConfig, number>;

    for (const dataType of dataTypes) {
      const { request, params, dataName } = requestConfig[dataType];

      logger.info(`Prepared request for ${dataType}`, { params });

      activeCursor = client.query(new Cursor(request, getQueryParams(params, requestInfo)));
      if (!countEntriesByTypes[dataType]) countEntriesByTypes[dataType] = 0;

      const stats = await streamCursorData({
        cursor: activeCursor,
        fetchSize,
        dataName,
        format,
        output: res,
        banFormatter: getSnapshotObjLine,
        converters: {
          'standard-fr': banToStandardFr,
          'standard-fr-int': banToStandardFrInt,
        },
        isAborted: () => aborted,
      });

      countEntriesByTypes[dataType] += stats.count;

      await closeCursor(activeCursor);
      activeCursor = null;

      if (aborted) {
        logger.info(`Stream aborted by the client during export for ${dataType}`);
        return;
      }

      logger.info(`Completed export for ${dataType}`);
    }

    // Close the stream with a meta line to indicate the end of the stream with stats info.
    res.write(getMetaLine('stream-end', { ...requestInfo, stats: countEntriesByTypes }));
    res.end();
  } catch (e) {
    logger.error("Error >>>", e);
    if (!res.headersSent) res.status(500);
    res.end(String(e instanceof Error ? e.message : e));
  } finally {
    try {
      client.release();
    } catch(err) {
      logger.error("Error releasing database client", err);
    }
  }
});

export default app
