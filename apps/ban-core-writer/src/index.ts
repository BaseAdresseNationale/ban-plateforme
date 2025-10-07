import rascal from 'rascal';
import { MongoClient } from 'mongodb';
import pg from 'pg';

import { env } from '@ban/config';

const rabbitConfig = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

type Label = {
  isoCode: string;
  value: string;
};
type Labels = Label[];

const DEFAULT_ISO_CODE = 'fra'; // Default ISO code for labels

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
    ? `mongodb://${env.MONGO.username}:${env.MONGO.password}@${env.MONGO.host}:${env.MONGO.port}/${env.MONGO.db}?authSource=admin`
    : `mongodb://${env.MONGO.host}:${env.MONGO.port}`;
    
const mongoDbName = env.MONGO.db;
const pgConfig = {
  host: env.PG.host,
  port: env.PG.port,
  user: env.PG.user,
  password: env.PG.password,
  database: env.PG.db,
};

const getLabelsFromRow = (row: Record<string, any>, defaultIsoCode: string = 'fra') => (colName: string) => {
  const labels: Labels = row[colName] ? [{ isoCode: defaultIsoCode, value: row[colName] }] : [];
  Object.entries(row).forEach(([key, value]) => {
    if (key.startsWith(`${colName}_`)) {
      const isoCode = key.replace(new RegExp(`^(${colName})_`, 'i'), '');
      labels.push({ isoCode, value });
    }
  });
  return labels;
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

  const defaultIsoCode = DEFAULT_ISO_CODE; // TODO: replace by district default ISO code if available

  rows.forEach((row: any) => {
    const getterLabels = getLabelsFromRow(row, defaultIsoCode);

    // District
    if (row.id_ban_commune) {
      districts[row.id_ban_commune] = {
        ...districts?.[row.id_ban_commune] || {},
        id: row.id_ban_commune,
        labels: getterLabels('commune_nom') || [],
      };
    }

    // Toponym
    if (row.id_ban_toponyme) {
      mainToponymes[row.id_ban_toponyme] = {
        ...mainToponymes?.[row.id_ban_toponyme] || {},
        id: row.id_ban_toponyme,
        districtID: row.id_ban_commune,
        district: districts[row.id_ban_commune] || {},
        labels: getterLabels('voie_nom') || [],
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
        labels: getterLabels('lieudit_complement_nom') || [],
        number: row.numero,
        suffix: row.suffixe,
        certified: [1, '1', 'oui', 'true', true].includes(row.certification_commune),
        positions: getItemPositions(addresses[row.id_ban_adresse], row),
        meta: {
          ban: {
            source: row.source || '',
            sourcePosition: row.ban_source_source_position || '',
            hashIdFix: row.ban_enrich_hash_id_fix || '',
            DEPRECATED_cleInterop: row.cle_interop || '',
            DEPRECATED_cleInteropBAN: row.ban_enrich_deprecated_cle_interop || '',
            targetKey: row.ban_enrich_ban_target_key_address || ['']
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
