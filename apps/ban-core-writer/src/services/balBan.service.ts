import { BalAdresse, BanDistrict } from '@ban/types';
import {
  getDistrictFromCOG,
  partialUpdateDistricts
} from '../helpers/ban-api/index.js';

import { getRevisionData } from "../helpers/dump-api/index.js";
import { sendBalToBan } from "../helpers/bal-converter/index.js";
import { MessageCatalog, DistrictInfoBuilder } from '../utils/status-catalog.js';
import { logger } from "../utils/logger.js";
import { sendWebhook } from '../utils/send-message-to-hook.js';
import checkAllJobs from '../utils/check-status-jobs.js'

interface BalGroup {
  [key: string]: BalAdresse[];
}

async function queryDistrictsFromCOG(cog: string) {
  const districts: BanDistrict[] = await getDistrictFromCOG(cog);
  if (!districts.length) {
    throw new Error(MessageCatalog.ERROR.NO_DISTRICT_FOUND.template(cog));
  }
  return districts;
}

function splitBalByDistrict(bal: BalAdresse[]): BalGroup {
  return bal.reduce((acc: BalGroup, balAdresse) => {
    if (balAdresse.id_ban_commune) {
      acc[balAdresse.id_ban_commune] = (acc[balAdresse.id_ban_commune] || []).concat(balAdresse);
    }
    return acc;
  }, {});
}

// @todo: import District type from orm
function findDistrictById(districts: District[], id: string): District | undefined {
  return districts.find(d => d.id === id);
}

function createDistrictUpdate(districtId: string, revision: Revision): DistrictUpdate {
  return {
    id: districtId,
    meta: {
      bal: {
        idRevision: revision.id,
        dateRevision: revision.publishedAt,
      },
    },
  };
}

async function handleThresholdError(result: any, cog: string, districts: District[], revision: Revision, districtName: string | null, id: string) {
  const hasThresholdError = result.errors.some((error:any) => error.type === 'DELETION_THRESHOLD_EXCEEDED');
  
  // Gérer les erreurs avec distinction entre seuil et autres erreurs
  if (hasThresholdError) {
    // Traiter le seuil comme un warning mais continuer
    const thresholdError = result.errors.find(e => e.type === 'DELETION_THRESHOLD_EXCEEDED');
    if (thresholdError) {
      const districtInfo = DistrictInfoBuilder.fromDistricts(districts.filter(d => d.meta?.bal?.idRevision));
      const warningMessage = MessageCatalog.WARNING.DELETION_THRESHOLD_SOON.template(cog, districtInfo, thresholdError.message);
      await sendWebhook(() => warningMessage, revision, cog, districtName, id, MessageCatalog.WARNING.DELETION_THRESHOLD_SOON.status);
    }
    // Continuer le traitement normal malgré le warning
  }
}

function handleOtherErrors(result: any, cog: string) {
  const otherErrors = result.errors.filter((error: any) => error.type !== 'DELETION_THRESHOLD_EXCEEDED');
  if (otherErrors.length > 0) {
    otherErrors.forEach((error: any) => logger.error(`${error.type}: ${error.message}`));
    const errorMessages = otherErrors.map((e: any) => e.message).join('\n');
    throw new Error(errorMessages);
  }
}

async function handleNoChanges(districtId: string, cog: string, results: string[]) {
  const message = MessageCatalog.INFO.NO_CHANGES.template(districtId, cog);
  logger.info(message);
  await sendWebhook(() => message, null, cog, null, districtId, MessageCatalog.INFO.NO_CHANGES.status);
  results.push(message);
}

async function handleDistrictUpdate(data: any, districtId: string, cog: string, results: string[]) {
  const responseBody = JSON.stringify(data);
  logger.info(MessageCatalog.INFO.DISTRICT_UPDATED.template(districtId, cog, responseBody));
  await checkAllJobs(data, districtId);
  results.push(data);
}

async function handleStatistics(result: any, cog: string, districtId: string, districts: District[], revision: Revision, districtName: string | null) {
  if (result.statistics && result.statistics.totalChanges > 0) {
    const statisticsMessage = MessageCatalog.INFO.PROCESSING_STATISTICS.template(
      result.statistics.districtID, 
      result.statistics.addressStats, 
      result.statistics.toponymStats
    );
    await sendWebhook(() => statisticsMessage, revision, cog, districtName, districtId, MessageCatalog.INFO.PROCESSING_STATISTICS.status);
  }
}

async function handleCriticalError(districts: District[], revision: Revision, cog: string, districtName: string | null, districtId: string, errorMessage: string) {
  const districtsOnNewDB = districts.filter((district) => district.meta?.bal?.idRevision);
  const districtInfo = DistrictInfoBuilder.fromDistricts(districtsOnNewDB);
  const message = MessageCatalog.ERROR.BAL_BLOCKED.template(cog, districtInfo, errorMessage);
  await sendWebhook(() => message, revision, cog, districtName, districtId, MessageCatalog.ERROR.BAL_BLOCKED.status);
}

async function processDistrict(balAddresses: BalAdresse[], districtId: string, districts: District[], revision: Revision, cog: string, results: string[], districtName: string | null) {
  const districtUpdate = createDistrictUpdate(districtId, revision);
  const result = (await sendBalToBan(balAddresses)) || {};

  // Gérer les erreurs avec distinction entre seuil et autres erreurs
  if (result.hasErrors) {
    handleThresholdError(result, cog, districts, revision, districtName, districtId);
    // Vérifier s'il y a d'autres erreurs vraiment bloquantes
    handleOtherErrors(result, cog);
  }

  if (!Object.keys(result.data).length) {
    handleNoChanges(districtId, cog, results);
  } else {
    handleDistrictUpdate(result.data, districtId, cog, results);
  }

  await partialUpdateDistricts([districtUpdate]);
  
  // Envoyer les statistiques si disponibles
  handleStatistics(result, cog, districtId, districts, revision, districtName);
}

async function processBalAdresses(parsedRows: any[]) {
  // Split BAL by district ID to handle multiple districts in a BAL
  const splitBalPerDistictID = splitBalByDistrict(parsedRows)
  const results: string[] = [];
    
  const cog = parsedRows[0].commune_insee;
  logger.info(MessageCatalog.INFO.USES_BAN_ID.template(cog));
  const districts: BanDistrict[] = await queryDistrictsFromCOG(cog);
  const { revision } = await getRevisionData(cog);

  for (let i = 0; i < Object.keys(splitBalPerDistictID).length; i++) {
    const [id, bal] = Object.entries(splitBalPerDistictID)[i];
    const district = findDistrictById(districts, id);
    const districtName = district?.labels[0].value || null;
    
    try {
      await processDistrict(bal, id, districts, revision, cog, results, districtName);
      const message = MessageCatalog.SUCCESS.DISTRICT_PROCESSED.template(id, cog);
      logger.info(message);
      await sendWebhook(() => message, revision, cog, districtName, id, MessageCatalog.SUCCESS.DISTRICT_PROCESSED.status);

    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error(errorMessage);
      results.push(MessageCatalog.ERROR.DISTRICT_ERROR.template(id, cog, errorMessage));
      
      // Autres erreurs vraiment bloquantes
      await handleCriticalError(districts, revision, cog, districtName, id, errorMessage);
      throw new Error(errorMessage);
    }
  }
  return results;
}

export default processBalAdresses;
