import rascal from 'rascal';

import { normalize } from '@nivalis/normadresse';

import { publications, rabbitmqConfig, subscriptions } from './rabbitmq.config.js';

const normalizeAFNOR = (input: string): string => normalize(input).replace(/\s+/g, '-');

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(rabbitmqConfig);

    const subscription = await broker.subscribe(subscriptions.balToTargetKey);
    subscription.on('message', async (message: any, content: any, ackOrNack: () => void) => {

      const enriched = {
        ...content,
        rows: content.rows.map((row: any) => {
          // TODO : récupérer les anciennes clés adresses et toponymes si elles existent
          const oldTargetKeysAddress: string[] = []
          const oldTargetKeysToponym: string[] = []
          const oldTargetKeysDistrict: string[] = []
          const suffix = row.suffixe ? `.${normalizeAFNOR(row.suffixe)}` : '';
          const voie_afnor = normalizeAFNOR(row.voie_nom || '');
          const district = row.commune_insee || 'DISTRICT';
          const toponym = voie_afnor || 'TOPONYM';
          const address = (!row.numero) && row.lieudit_complement_nom
            ? normalizeAFNOR(row.lieudit_complement_nom)
            : `${row.numero || 'ADDRESS'}${suffix}`;
          return {
            ...row,
            ban_enrich_deprecated_cle_interop: `${row.commune_insee}_${row.id_voie}_${row.numero}${suffix}`,
            ban_enrich_ban_target_keys_address: [`${district}~${toponym}~${address}`, ...oldTargetKeysAddress],
            ban_enrich_ban_target_keys_toponym: [`${district}~${toponym}`, ...oldTargetKeysToponym],
            ban_enrich_ban_target_keys_district: [`${district}`, ...oldTargetKeysDistrict],
          };
        })
      };

      await broker.publish(publications.withTargetKey, JSON.stringify(enriched), {
        options: { contentType: 'application/json' }
      });

      console.log('[target-key] Message publié sur "bal.enriched.target-key"');
      ackOrNack();
    });

    console.log('[target-key] En écoute...');
  } catch (err) {
    console.error('[target-key] Erreur:', err);
    process.exit(1);
  }
}

main();
