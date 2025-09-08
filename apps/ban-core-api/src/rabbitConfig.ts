import { env } from '@ban/config';

import type { BrokerConfig } from 'rascal';

const rabbitConfig = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

/**
 * Construit une configuration Rascal de base depuis les variables d'environnement
 * @param opts Options pour personnaliser les noms de queues et exchanges
 */
export function createBrokerConfigFromEnv(opts?: {
  exchange?: string;
  queue?: string;
  routingKey?: string;
}): BrokerConfig {
  const exchangeName = opts?.exchange ?? 'bal.events';
  const queueName = opts?.queue ?? 'default.in';
  const routingKey = opts?.routingKey ?? '#';

  return {
    vhosts: {
      '/': {
        connection: {
          protocol: 'amqp',
          ...rabbitConfig,
        },

        // Type de l'exchange (point de publication de messages). Type dExchange possible 
        // 'direct', 'fanout', 'topic', 'headers'
        // 'topic' est le plus flexible pour les systèmes de messagerie car il permet de router les messages
        // 'direct' est utilisé pour les messages destinés à une seule queue
        // 'fanout' envoie les messages à toutes les queues liées
        // 'headers' utilise des en-têtes pour router les messages
        exchanges: [{ name: exchangeName, type: 'topic' }],

        //
        queues: [{ name: queueName, assert: true }], // Optionnel : si tu veux créer la queue automatiquement / Assure que la queue existe
        bindings: [ // Optionnel : si tu veux lier l'exchange à la queue
          {
            source: exchangeName,
            destination: queueName,
            bindingKey: routingKey
          }
        ]
      }
    },
    subscriptions: {
      default: { queue: queueName }
    },
    publications: {
      default: {
        exchange: exchangeName,
        routingKey
      }
    }
  };
}
