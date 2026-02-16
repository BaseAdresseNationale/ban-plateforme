import rascal from 'rascal';

import { env } from '@ban/config';

const rabbitConfig = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

// Une ligne enrichie, de structure libre
type EnrichedRow = Record<string, any>;

// Buffer local pour stocker les enrichissements ligne par ligne
type EnrichmentBuffer = {
  [rowId: string]: EnrichedRow;
};

// Données agrégées pour une BAL donnée
type PendingBAL = {
  receivedFrom: Set<string>;         // Quels enrichisseurs ont déjà répondu ?
  rows: EnrichmentBuffer;            // Lignes fusionnées par row.id
  meta: any;                         // Métadonnées (parsedAt, filename...)
  timeout?: NodeJS.Timeout;          // Pour éviter l’attente infinie
};

// Liste des enrichisseurs qu’on attend
const expectedEnrichers = ['beautifier', 'target-key', 'old-district', 'postal-code'];

// Durée maximale d’attente avant fallback (en ms)
const timeoutMs = 5000;

// État mémoire tampon : Map balId => données partielles
const state = new Map<string, PendingBAL>();

// Config Rascal pour RabbitMQ
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
        { name: 'merger.in', assert: true }
      ],
      bindings: [
        {
          source: 'bal.events',
          destination: 'merger.in',
          bindingKey: 'bal.enriched.*' // fanout sur tous les enrichisseurs
        }
      ]
    }
  },
  subscriptions: {
    balEnriched: {
      queue: 'merger.in'
    }
  },
  publications: {
    ready: {
      exchange: 'bal.events',
      routingKey: 'bal.ready' // une fois fusionné
    }
  }
};

// Fusionne les nouvelles lignes avec les existantes
function mergeRows(existing: EnrichmentBuffer, newRows: EnrichedRow[]): EnrichmentBuffer {
  const merged = { ...existing };
  for (const row of newRows) {
    const id = row.__balRowIndex;
    if (typeof id === 'undefined') continue;
    merged[id] = { ...merged[id], ...row }; // merge clé par clé
  }
  return merged;
}

async function main() {
  const broker = await rascal.BrokerAsPromised.create(config);

  // Abonnement aux messages enrichis
  const subscription = await broker.subscribe('balEnriched');
  subscription.on('message', async (message: any, content: any, ackOrNack: () => void) => {

    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      const balId = parsed.id;
      const routingKey: string = message.fields.routingKey;
      const enricher = routingKey.split('.').pop(); // Ex: 'beautifier'

      if (!balId || !parsed.rows || !Array.isArray(parsed.rows)) {
        console.warn('[merger] message ignoré, balId ou rows invalide');
        return ackOrNack();
      }

      // Récupère ou initialise l’état actuel de cette BAL
      const existing = state.get(balId) ?? {
        receivedFrom: new Set(),
        rows: {},
        meta: parsed.meta,
      };

      // Marque cet enrichisseur comme "reçu"
      existing.receivedFrom.add(enricher as string);
      existing.rows = mergeRows(existing.rows, parsed.rows);
      state.set(balId, existing);

      console.log(`[merger] reçu ${enricher} pour ${balId} (${existing.receivedFrom.size}/${expectedEnrichers.length})`);

      // Vérifie si tous les enrichisseurs ont répondu
      const isComplete = expectedEnrichers.every(name => existing.receivedFrom.has(name));

      const publishReady = async () => {
        const mergedMessage = {
          id: balId,
          meta: existing.meta,
          rows: Object.values(existing.rows)
        };
        await broker.publish('ready', JSON.stringify(mergedMessage), {
          options: { contentType: 'application/json' }
        });
        console.log(`[merger] Fusion de ${parsed.rows.length} lignes pour ${balId}`);
        console.log(`[merger] publication bal.ready pour ${balId}`);
        state.delete(balId);
      };

      // Si complet, on publie immédiatement
      if (isComplete) {
        clearTimeout(existing.timeout);
        await publishReady();
      }
      // Sinon on démarre un timeout (si pas déjà fait)
      else if (!existing.timeout) {
        existing.timeout = setTimeout(() => {
          console.warn(`[merger] timeout pour ${balId}, publication partielle`);
          publishReady();
        }, timeoutMs);
      }

      ackOrNack();
    } catch (err) {
      console.error('[merger] erreur de traitement message:', err);
      ackOrNack();
    }
  });

  console.log('[merger] En écoute...');
}

main();
