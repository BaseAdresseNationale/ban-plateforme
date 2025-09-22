import rascal from 'rascal';

import { env } from '@ban/config';

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
        { name: 'target-key.in', assert: true }
      ],
      bindings: [
        {
          source: 'bal.events',
          destination: 'target-key.in',
          bindingKey: 'bal.enrich'
        }
      ]
    }
  },
  subscriptions: {
    'balToTargetKey': {
      queue: 'target-key.in'
    }
  },
  publications: {
    'withTargetKey': {
      exchange: 'bal.events',
      routingKey: 'bal.enriched.target-key'
    }
  }
};

function normalizeAFNOR(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // enlever accents
    .replace(/[^a-z0-9 ]/g, '') // caractères spéciaux
    .replace(/\s+/g, '_'); // espaces -> "_"
}

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(config);

    const subscription = await broker.subscribe('balToTargetKey');
    subscription.on('message', async (message: any, content: any, ackOrNack: () => void) => {

      const enriched = {
        ...content,
        rows: content.rows.map((row: any) => {
          const suffix = row.suffix ? `.${row.suffix}` : '';
          const voie_afnor = normalizeAFNOR(row.voie_nom || '');
          const district = row.commune_insee || 'CC';
          const toponym = voie_afnor || 'VA';
          const address = (!row.numero) && row.lieudit_complement_nom
            ? row.lieudit_complement_nom
            : `${row.numero || ''}${suffix}`;
          return {
            ...row,
            ban_enrich_deprecated_cle_interop: `${row.commune_insee}_${row.id_voie}_${row.numero}${suffix}`,
            ban_enrich_ban_target_key: `${district}~${toponym}~${address}`
          };
        })
      };
      console.log('[target-key] data : ', enriched.rows[0]);
      await broker.publish('withTargetKey', JSON.stringify(enriched), {
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
