import rascal from 'rascal';

import { publications, rabbitmqConfig, subscriptions } from './rabbitmq.config.js';

async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(rabbitmqConfig);

    // Le nom de subscription est défini dans `rabbitmq.config.ts`.
    // C'est le point d'entrée des messages consommés par le service.
    const subscription = await broker.subscribe(subscriptions.messageToProcess);

    subscription.on('message', async (_message: any, content: any, ackOrNack: () => void) => {
      // Remplacez ce bloc par le traitement métier du microservice.
      // `content` contient le payload reçu depuis RabbitMQ.
      const processed = {
        ...content,
        rows: content.rows.map((row: any) => ({
          ...row,
          // ban_enrich_service_name: row.voie_nom?.toUpperCase(),
        })),
      };

      // Le nom de publication est défini dans `rabbitmq.config.ts`.
      // La routing key et l'exchange restent centralisés dans cette config locale.
      await broker.publish(publications.messageProcessed, JSON.stringify(processed), {
        options: { contentType: 'application/json' },
      });

      // Appelez `ackOrNack()` uniquement après le traitement et les publications nécessaires.
      console.log('[service-name] Message publié');
      ackOrNack();
    });

    console.log('[service-name] En écoute...');
  } catch (err) {
    console.error('[service-name] Erreur:', err);
    process.exit(1);
  }
}

main();
