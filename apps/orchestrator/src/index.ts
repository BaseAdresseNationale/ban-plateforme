import rascal from 'rascal';

import { publications, rabbitmqConfig, subscriptions } from './rabbitmq.config.js';

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(rabbitmqConfig);

    interface EnrichedMessage {
      [key: string]: any;
      meta: {
      orchestratedAt: string;
      };
    }

    const subscription = await broker.subscribe(subscriptions.balParsed);
    subscription.on('message', async (message: any, content: Record<string, any>, ackOrNack: () => void) => {
      console.log('[orchestrator] Message reçu depuis bal-parser:', typeof content, content.toString(), content.id);

      const enriched: EnrichedMessage = {
        ...content,
        meta: { orchestratedAt: new Date().toISOString() }
      };

      await broker.publish(publications.fanoutEnrichments, enriched);
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
