import rascal, { BrokerConfig, ConnectionAttributes } from 'rascal';

// @ts-ignore // Remove this comment when you use the boilerplate
import { env } from '@ban/config';

const rabbitConfig: ConnectionAttributes = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

const exchangeName = 'bal.events'; // Nom de l'échange utilisé pour publier et recevoir les messages
const queueName = 'serviceName.in'; // Remplacez par le nom de la file d'attente que vous souhaitez utiliser pour recevoir les messages
const bindingKey = 'bal.enrich'; // Remplacez par la clé de liaison que vous souhaitez utiliser pour recevoir les messages
const routingKey = 'bal.enriched.beautifier'; // Remplacez par la clé de routage que vous souhaitez utiliser pour publier les messages enrichis
const subscriberName = 'balToBeautify'; // Nom de la souscription permettant de recevoir les messages à traiter, peut être personnalisé
const publicationName = 'beautified'; // Nom de la publication, peut être personnalisé

// Configuration de Rascal pour RabbitMQ
// On utilise les variables d'environnement définies dans le fichier de configuration
// pour se connecter à RabbitMQ et configurer les échanges, files d'attente et liaisons.
// Le fichier de configuration est importé depuis le module @ban/config.
// Mettre à jour le fichier de configuration si nécessaire pour adapter les échanges, files d'attente et liaisons.
const config: BrokerConfig = {
  vhosts: {
    '/': {
      connection: {
        protocol: 'amqp',
        ...rabbitConfig,
      },
      exchanges: [
        // On définit un échange nommé (variable `exchangeName` declarée plus haut) de type 'topic'
        { name: exchangeName, type: 'topic' as const }
      ],
      queues: [
        // On crée une file d'attente nommée (ici `queueName`, definit plus haut) qui sera utilisée
        // pour recevoir les messages à traiter par le service.
        { name: queueName, assert: true }
      ],
      bindings: [
        // On lie explicitement l'échange nommé (`exchangeName`) à la file d'attente (`queueName`)
        // avec une clé de liaison (`bindingKey`, definit plus haut) pour recevoir les messages à traiter.
        // Cela permet au service de recevoir les messages qui lui sont destinés.
        {
          source: exchangeName,
          destination: queueName,
          bindingKey
        }
      ]
    }
  },
  // Souscriptions pour écouter les messages entrants
  subscriptions: {
    [subscriberName]: {
      queue: queueName
    }
  },
  // Publications pour envoyer les messages enrichis
  publications: {
    [publicationName]: {
      exchange: exchangeName,
      routingKey
    }
  }
};

async function main() {
  try {
    // Création du broker Rascal avec la configuration définie
    const broker = await rascal.BrokerAsPromised.create(config);

    // Souscription à la file d'attente (`queueName`) pour recevoir les messages à traiter
    const subscription = await broker.subscribe(subscriberName);
    
    // Écoute des messages entrants
    // Paramètres :
    // -- message: le message reçu (objet Rascal Message)
    // -- content: le contenu du message, (objet JSON ou chaîne de caractères)
    // -- ackOrNack: fonction pour accuser réception ou rejeter le message, a appeler après traitement
    subscription.on('message', async (message: any, content: any, ackOrNack: () => void) => {

      // Traitement du message reçu:
      // On effectue des taches avec le contenu du message,
      // puis on publie un message enrichi sur l'échange nommé (`exchangeName`).
      const enriched = {
        ...content,
        rows: content.rows.map((row: any) => ({
          ...row,
          // ban_enrich_something: row.voie_nom?.toUpperCase(),
        }))
      };

      // Publication du message enrichi sur l'échange nommé (`exchangeName`) avec la clé de routage (`routingKey`)
      await broker.publish(publicationName, JSON.stringify(enriched), {
        options: { contentType: 'application/json' }
      });

      // Accusation de réception du message
      console.log(`[beautifier] Message publié sur "${exchangeName}" avec la clé de routage "${routingKey}" et la clé de publication "${publicationName}"`);
      ackOrNack();
    });

    console.log('[beautifier] En écoute...');
  } catch (err) {
    console.error('[beautifier] Erreur:', err);
    process.exit(1);
  }
}

main();
