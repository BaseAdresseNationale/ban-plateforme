import rascal from 'rascal';
import { createGazetteer } from '@ban-team/gazetteer'

import { publications, rabbitmqConfig, subscriptions } from './rabbitmq.config.js';

const serviceName = 'old-district';

const gazetteerOptions = {
  dbPath: './data/gazetteer.sqlite',
  cacheEnabled: true,
  cacheSize: 100
}


async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(rabbitmqConfig);

    const gazetteer = await createGazetteer(gazetteerOptions)
    const subscription = await broker.subscribe(subscriptions.balToOldDistrict);

    subscription.on('message', async (message: any, content: any, ackOrNack: () => void) => {

      const oldDistricts = await Promise.all(content.rows.map(async (row: any) => {
        if (!row.long || !row.lat) return null;
        const { communeAncienne } = await gazetteer.find({ lon: row.long, lat: row.lat }) || {};
        return {
          old_district_name: communeAncienne?.nom || undefined,
          old_district_code: communeAncienne?.code || undefined,
        };
      }));

      const enriched = {
        ...content,
        rows: content.rows.map((row: any, index: number) => ({
          ...row,
          ban_enrich_old_district_name: oldDistricts[index]?.old_district_name,
          ban_enrich_old_district_code: oldDistricts[index]?.old_district_code,
        }))
      };

      await broker.publish(publications.withOldDistrict, JSON.stringify(enriched), {
        options: { contentType: 'application/json' }
      });

      ackOrNack();
    });

    console.log(`[${serviceName}] En écoute...`);
  } catch (err) {
    console.error(`[${serviceName}] Erreur:`, err);
    process.exit(1);
  }
}

main();
