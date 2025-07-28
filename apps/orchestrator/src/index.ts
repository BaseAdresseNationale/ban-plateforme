import rascal from 'rascal';

import '@ban/config';
import { env } from '@ban/config';

import type { BrokerConfig } from 'rascal';

const rabbitConfig = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

const config: BrokerConfig = {
  vhosts: {
    '/': {
      connection: {
        protocol: 'amqp',
        ...rabbitConfig,
      },
      exchanges: [
        { name: 'bal.events', type: "topic" as "topic" }
      ],
      queues: [
        { name: 'orchestrator.in', assert: true }
      ],
      bindings: [
        {
          source: 'bal.events',
          destination: 'orchestrator.in',
          bindingKey: 'bal.parsed'
        }
      ]
    }
  },
  publications: {
    'fanout.enrichments': {
      exchange: 'bal.events',
      routingKey: 'bal.enrich'
    }
  },
  subscriptions: {
    'balParsed': {
      queue: 'orchestrator.in'
    }
  }
};

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(config);

    interface EnrichedMessage {
      [key: string]: any;
      meta: {
      orchestratedAt: string;
      };
    }

    const subscription = await broker.subscribe('balParsed');
    subscription.on('message', async (message: any, content: Record<string, any>, ackOrNack: () => void) => {
      console.log('[orchestrator] Message reçu depuis bal-parser:', typeof content, content.toString(), content.id);

      const enriched: EnrichedMessage = {
        ...content,
        meta: { orchestratedAt: new Date().toISOString() }
      };

      await broker.publish('fanout.enrichments', enriched);
      console.log('[orchestrator] Message publié sur "bal.enrich"');
      ackOrNack();
    });

    console.log('[orchestrator] En écoute...');
  } catch (err) {
    console.error('[orchestrator] Erreur:', err);
    process.exit(1);
  }
}

main();
