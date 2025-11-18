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

async function queryDistrictsFromCOG(cog: string) {
  const districts: BanDistrict[] = await getDistrictFromCOG(cog);
  if (!districts.length) {
    throw new Error(MessageCatalog.ERROR.NO_DISTRICT_FOUND.template(cog));
  }
  return districts;
}
async function processBalBan(parsedRows: any[]) {
  // Split BAL by district ID to handle multiple districts in a BAL
  const splitBalPerDistictID = parsedRows.reduce(
    (acc: { [key: string]: BalAdresse[] }, balAdresse) => {
      if (balAdresse.id_ban_commune) {
        if (!acc[balAdresse.id_ban_commune]) {
          acc[balAdresse.id_ban_commune] = [];
        }
        acc[balAdresse.id_ban_commune].push(balAdresse);
      }
      return acc;
    },
    {}
  );

  const results = [];
  const cog = parsedRows[0].commune_insee;
  logger.info(MessageCatalog.INFO.USES_BAN_ID.template(cog));
  const districts: BanDistrict[] = await queryDistrictsFromCOG(cog);
  const { revision } = await getRevisionData(cog);

  for (let i = 0; i < Object.keys(splitBalPerDistictID).length; i++) {
    const [id, bal] = Object.entries(splitBalPerDistictID)[i];
    const district = districts.find(d => d.id === id);
    const districtName = district?.labels[0].value || null;
    
    const districtUpdate = {
      id,
      meta: {
        bal: {
          idRevision: revision.id,
          dateRevision: revision.publishedAt,
        },
      },
    };
    
    try {
      const result = (await sendBalToBan(bal)) || {};
      
      // Gérer les erreurs avec distinction entre seuil et autres erreurs
      if (result.hasErrors) {
        const hasThresholdError = result.errors.some(error => 
          error.type === 'DELETION_THRESHOLD_EXCEEDED'
        );
        
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
        
        // Vérifier s'il y a d'autres erreurs vraiment bloquantes
        const otherErrors = result.errors.filter(error => error.type !== 'DELETION_THRESHOLD_EXCEEDED');
        if (otherErrors.length > 0) {
          otherErrors.forEach(error => {
            logger.error(`${error.type}: ${error.message}`);
          });
          
          const errorMessages = otherErrors.map(e => e.message).join('\n');
          throw new Error(errorMessages);
        }
      }

      if (!Object.keys(result.data).length) {
        const message = MessageCatalog.INFO.NO_CHANGES.template(id, cog);
        logger.info(message);
        
        await sendWebhook(() => message, revision, cog, districtName, id, MessageCatalog.INFO.NO_CHANGES.status);
        
        results.push(message);
      } else {
        const responseBody = JSON.stringify(result.data);
        logger.info(MessageCatalog.INFO.DISTRICT_UPDATED.template(id, cog, responseBody));
        
        await checkAllJobs(result.data, id);
        results.push(result.data);
      }

      await partialUpdateDistricts([districtUpdate]);
      
      // Envoyer les statistiques si disponibles
      if (result.statistics && result.statistics.totalChanges > 0) {
        const statisticsMessage = MessageCatalog.INFO.PROCESSING_STATISTICS.template(
          result.statistics.districtID, 
          result.statistics.addressStats, 
          result.statistics.toponymStats
        );
        
        await sendWebhook(
          () => statisticsMessage,
          revision,
          cog,
          districtName,
          id,
          MessageCatalog.INFO.PROCESSING_STATISTICS.status
        );
      }
      
      const message = MessageCatalog.SUCCESS.DISTRICT_PROCESSED.template(id, cog);
      logger.info(message);
      await sendWebhook(() => message, revision, cog, districtName, id, MessageCatalog.SUCCESS.DISTRICT_PROCESSED.status);

    } catch (error) {
      const errorMessage = (error as Error).message;
      const districtsOnNewDB = districts.filter((district) => district.meta?.bal?.idRevision);
      logger.error(errorMessage);
      results.push(MessageCatalog.ERROR.DISTRICT_ERROR.template(id, cog, errorMessage));
      
      // Autres erreurs vraiment bloquantes
      const districtInfo = DistrictInfoBuilder.fromDistricts(districtsOnNewDB);
      const message = MessageCatalog.ERROR.BAL_BLOCKED.template(cog, districtInfo, errorMessage);
      await sendWebhook(() => message, revision, cog, districtName, id, MessageCatalog.ERROR.BAL_BLOCKED.status);
      
      throw new Error(message);
    }
  }
  return results;
}

export default processBalBan;
