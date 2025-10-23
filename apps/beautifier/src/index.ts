import rascal from 'rascal';
import { beautifyUppercased, normalizeSuffixe, DEFAULT_ISO_CODE } from './string.js'

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

type Label = {
  isoCode: string;
  value: string;
};
type Labels = Label[];

const getLabelsFromRow = (row: Record<string, any>, colName: string, defaultIsoCode: string) => {
  const labels: Labels = row[colName] ? [{ isoCode: defaultIsoCode, value: beautifyUppercased(row[colName], defaultIsoCode) }] : [];
  Object.entries(row).forEach(([key, value]: [string, string], index: number) => {
    if (key.startsWith(`${colName}_`)) {
      const isoCode = key.replace(new RegExp(`^(${colName})_`, 'i'), '');
      labels.push({ isoCode, value: beautifyUppercased(value, isoCode) });
    }
  });
  return labels;
};


async function main() {
  try {
    const broker = await rascal.BrokerAsPromised.create(config);

    const subscription = await broker.subscribe('balToBeautify');
    subscription.on('message', async (message: any, content: any, ackOrNack: () => void) => {
      const defaultIsoCode = DEFAULT_ISO_CODE; // TODO: replace by district default ISO code if available

      const enriched = {
        ...content,
        rows: content.rows.map((row: any) => ({
          ...row,
          ban_enrich_beautified_suffixe: row.suffixe ? normalizeSuffixe(row.suffixe) : '',
          ban_enrich_beautified_labels_voie_nom: getLabelsFromRow(row, 'voie_nom', defaultIsoCode),
          ban_enrich_beautified_labels_lieudit_complement_nom: getLabelsFromRow(row, 'lieudit_complement_nom', defaultIsoCode),
          ban_enrich_beautified_labels_commune_nom: getLabelsFromRow(row, 'commune_nom', defaultIsoCode),
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
