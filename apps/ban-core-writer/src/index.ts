import rascal from 'rascal';
import { MongoClient } from 'mongodb';
import pg from 'pg';

import { env } from '@ban/config';
import { BalAdresse, BanDistrict } from '@ban/types';

import {
  getDistrictFromCOG,
  partialUpdateDistricts,
  // sendBalToLegacyCompose,
} from './helpers/ban-api/index.js';
import { getRevisionData } from "./helpers/dump-api/index.js";
import { sendBalToBan } from "./helpers/bal-converter/index.js";
import { MessageCatalog, DistrictInfoBuilder } from './utils/status-catalog.js';
import { logger } from "./utils/logger.js";
import { sendWebhook } from './utils/send-message-to-hook.js';
import checkAllJobs from './utils/check-status-jobs.js'

const rabbitConfig = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

const config = {
  vhosts: {
    '/': {
      connection: {
        protocol: 'amqp',
        ...rabbitConfig,
      },
      exchanges: [
        { name: 'bal.events', type: 'topic' as const }
      ],
      queues: [
        { name: 'writer.in', assert: true }
      ],
      bindings: [
        {
          source: 'bal.events',
          destination: 'writer.in',
          bindingKey: 'bal.ready'
        }
      ]
    }
  },
  subscriptions: {
    balReady: {
      queue: 'writer.in'
    }
  }
};

const { Pool } = pg;

const mongoUrl =
  env.MONGO.username && env.MONGO.password
    ? `mongodb+srv://${env.MONGO.username}:${env.MONGO.password}@${env.MONGO.host}?replicaSet=replicaset&tls=true&authSource=admin&readPreference=primary`
    : `mongodb://${env.MONGO.host}:${env.MONGO.port}`;
console.log(`[ban-writer] Mongo URL: ${mongoUrl}`);
const mongoDbName = env.MONGO.db;
const pgConfig = {
  host: env.PG.host,
  port: env.PG.port,
  user: env.PG.user,
  password: env.PG.password,
  database: env.PG.db,
};

const getItemPositions = (item: Record<string, any> | undefined, row: Record<string, any>) => {
  const position = item?.positions || [];
  position.push({
    type: row.position || 'unknown', // TODO : Convert position name to a standard type if needed
    geometry: {
      type: 'Point',
      system: 'WGS84',
      coordinates: [row.long, row.lat],
      legalMapProjection: {
        system: 'Lambert-93', // TODO: Replace with actual projection if available
        coordinates: [row.x, row.y],
      },
    },
  });
  return position;
};

const getBanObjectsFromBalRows = (rows: any[]) => {
  const addresses: Record<string, any> = {};
  const mainToponymes: Record<string, any> = {};
  const districts: Record<string, any> = {};

  rows.forEach((row: any) => {
    // TODO: Gérer les fusions profondes (plusieurs lignes pour une même entité) cf. oldDistrict

    // District
    if (row.id_ban_commune) {
      districts[row.id_ban_commune] = {
        ...districts?.[row.id_ban_commune] || {},
        id: row.id_ban_commune,
        labels: row.ban_enrich_beautified_labels_commune_nom,
      };
    }

    // Toponym
    if (row.id_ban_toponyme) {
      mainToponymes[row.id_ban_toponyme] = {
        ...mainToponymes?.[row.id_ban_toponyme] || {},
        id: row.id_ban_toponyme,
        districtID: row.id_ban_commune,
        district: districts[row.id_ban_commune] || {},
        labels: row.ban_enrich_beautified_labels_voie_nom,
        // certified: [1, '1', 'oui', 'true', true].includes(row.certification_commune), // TODO: Add certified field if available
        geometry: {
          type: 'Point',
          coordinates: [row.long, row.lat],
        },
        meta: {
          ban: {
            category: row.ban_categorie || 'voie',
            source: row.source || '',
            sourceNomVoie: row.ban_source_nom_voie || '', // TODO: WHAT IS THIS?
            hashIdFix: row.ban_enrich_hash_id_fix || '',
            DEPRECATED_id: '???',
            DEPRECATED_groupId: row.slug || '',
            DEPRECATED_cleInterop: row.cle_interop || '',
            DEPRECATED_cleInteropBAN: row.ban_enrich_deprecated_cle_interop || '',
            targetKey: row.ban_enrich_ban_target_key_toponym || ['']
          },
          dgfip: {
            cadastre: (row.cadastre_parcelles || row.cad_parcelles || null)?.split('|') || [],
            DEPRECATED_codeFantoir: row.ban_enrich_code_fantoir || '',
          },
          insee: {
            cog: row.commune_insee || '',
            mainCog: row.ban_enrich_main_cog || '',
            isMainCog: row.ban_enrich_is_main_cog || '',
          },
          laPoste: {
            codePostal: row.ban_enrich_code_postal ? [row.ban_enrich_code_postal.split('|')] : [],
          },
        },
        legalityDate: row.date_der_maj || '',
        lastRecordDate: new Date().toISOString(), // Assuming last record date is now
      };
    }

    // Address
    if (row.id_ban_adresse) {
      addresses[row.id_ban_adresse] = {
        ...addresses?.[row.id_ban_adresse] || {},
        id: row.id_ban_adresse,
        mainCommonToponymID: row.id_ban_toponyme,
        secondaryCommonToponymIDs: row.id_ban_toponymes_secondaires ? row.id_ban_toponymes_secondaires.split('|') : [],
        districtID: row.id_ban_commune,
        mainCommonToponym: mainToponymes[row.id_ban_toponyme] || {},
        districts: districts[row.id_ban_commune] || {},
        labels: row.ban_enrich_beautified_labels_lieudit_complement_nom,
        number: row.numero,
        suffix: row.ban_enrich_beautified_suffixe
          ? row.ban_enrich_beautified_suffixe
          : addresses[row.id_ban_adresse]?.suffix || '',
        certified: [1, '1', 'oui', 'true', true].includes(row.certification_commune),
        positions: getItemPositions(addresses[row.id_ban_adresse], row),
        meta: {
          ban: {
            source: row.source || '',
            sourcePosition: row.ban_source_source_position || '',
            hashIdFix: row.ban_enrich_hash_id_fix || '',
            DEPRECATED_cleInterop: row.cle_interop || '',
            DEPRECATED_cleInteropBAN: row.ban_enrich_deprecated_cle_interop || '',
            targetKey: row.ban_enrich_ban_target_key_address || [''],
            oldDistrict: row.ban_enrich_old_district_code && row.ban_enrich_old_district_name
              ? {
                "labels": [{
                  "isoCode": "fra",
                  "value": row.ban_enrich_old_district_name
                }],
                "code": row.ban_enrich_old_district_code
              }
              : addresses[row.id_ban_adresse]?.meta?.ban?.oldDistrict || null,
          },
          dgfip: {
            cadastre: (row.cadastre_parcelles || row.cad_parcelles || null)?.split('|') || [],
            DEPRECATED_codeFantoir: row.ban_enrich_code_fantoir || '',
          },
          insee: {
            cog: row.commune_insee || '',
            mainCog: row.ban_enrich_main_cog || '',
            isMainCog: row.ban_enrich_is_main_cog || '',
          },
          laPoste: {
            codePostal: row.ban_enrich_code_postal ? [row.ban_enrich_code_postal.split('|')] : [],
          },
        },
        legalityDate: row.date_der_maj || '',
        lastRecordDate: new Date().toISOString(), // Assuming last record date is now
      }
    }
  });

  return {
    districts,
    mainToponymes,
    addresses,
  };
}

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

async function main() {
  const mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();
  const mongoDb = mongoClient.db(mongoDbName);

  const mongoCollectionDistricts = mongoDb.collection('districts');
  const mongoCollectionMainToponyms = mongoDb.collection('mainToponyms');
  const mongoCollectionAddresses = mongoDb.collection('addresses');

  const pgPool = new Pool(pgConfig); // TODO: Implement real value for PG

  const broker = await rascal.BrokerAsPromised.create(config);
  const subscription = await broker.subscribe('balReady');

  subscription.on('message', async (_message: any, content: any, ackOrNack: () => void) => {
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;

      const hasAllIds = parsed.rows.every(
        (row: any) =>
          row.id_ban_commune && row.id_ban_toponyme && row.id_ban_adresse
      );

      if (hasAllIds) {
        // Écriture PostgreSQL simulée (à remplacer par du vrai SQL)
        console.log(`[writer] Enregistrement PostgreSQL de ${parsed.rows.length} lignes`);
        processBalBan(parsed.rows);
      } else {
        console.log(`[writer] Données incomplètes pour PostgreSQL, passage MongoDB`);
      }

      // MongoDB
      const banObjects = getBanObjectsFromBalRows(parsed.rows);

      // Delete existing documents in MongoDB
      console.log(`[writer] Suppression des documents existants pour BAL ${parsed.id}`);
      const parsedDistrictsIds = Object.keys(banObjects.districts);
      await Promise.all([
        mongoCollectionAddresses.deleteMany({ districtID: { $in: parsedDistrictsIds } }),
        mongoCollectionMainToponyms.deleteMany({ districtID: { $in: parsedDistrictsIds } }),
        mongoCollectionDistricts.deleteMany({ id: { $in: parsedDistrictsIds } }),
      ]);
      console.log(`[writer] Documents existants pour BAL ${parsed.id} contenant le(s) district(s) ${parsedDistrictsIds.join(', ')} supprimé(s)`);

      // Enregistrement MongoDB
      const currentTimestamp = new Date().toISOString();
      console.log(`[writer] Enregistrement MongoDB de BAL ${parsed.id} avec ${Object.keys(banObjects.districts).length} districts, ${Object.keys(banObjects.mainToponymes).length} toponymes et ${Object.keys(banObjects.addresses).length} adresses`);
      await Promise.all([
        mongoCollectionDistricts.insertMany(
          Object.values(banObjects?.districts).map(doc => ({
            ...doc,
            storedAt: currentTimestamp,
          })),
        ),
        mongoCollectionMainToponyms.insertMany(
          Object.values(banObjects?.mainToponymes).map(doc => ({
            ...doc,
            storedAt: currentTimestamp,
          })),
        ),
        mongoCollectionAddresses.insertMany(
          Object.values(banObjects?.addresses).map(doc => ({
            ...doc,
            storedAt: currentTimestamp,
          })),
        ),
      ]);
      console.log(`[writer] BAL ${parsed.id} enregistrée en MongoDB`);

      ackOrNack();
    } catch (err) {
      console.error('[writer] erreur de traitement message :', err);
      ackOrNack();
    }
  });

  console.log('[writer] En écoute sur bal.ready...');
}

main();
