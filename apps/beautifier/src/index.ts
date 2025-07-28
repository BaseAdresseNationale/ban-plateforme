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
        { name: 'beautifier.in', assert: true }
      ],
      bindings: [
        {
          source: 'bal.events',
          destination: 'beautifier.in',
          bindingKey: 'bal.enrich'
        }
      ]
    }
  },
  subscriptions: {
    'balToBeautify': {
      queue: 'beautifier.in'
    }
  },
  publications: {
    'beautified': {
      exchange: 'bal.events',
      routingKey: 'bal.enriched.beautifier'
    }
  }
};

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(config);

    const subscription = await broker.subscribe('balToBeautify');
    subscription.on('message', async (message: any, content: any, ackOrNack: () => void) => {

      const enriched = {
        ...content,
        rows: content.rows.map((row: any) => ({
          ...row,
          ban_enrich_beautified_voie_nom: row.voie_nom?.toUpperCase(),
          ban_enrich_voie_nom_afnor: row.voie_nom?.toUpperCase()
        }))
      };

      await broker.publish('beautified', JSON.stringify(enriched), {
        options: { contentType: 'application/json' }
      });

      console.log('[beautifier] Message publié sur "bal.enriched.beautifier"');
      ackOrNack();
    });

    console.log('[beautifier] En écoute...');
  } catch (err) {
    console.error('[beautifier] Erreur:', err);
    process.exit(1);
  }
}

main();
