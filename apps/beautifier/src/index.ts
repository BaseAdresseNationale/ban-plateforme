import rascal from 'rascal';
import { beautifyUppercased, normalizeSuffixe, DEFAULT_ISO_CODE } from './string.js'

import { publications, rabbitmqConfig, subscriptions } from './rabbitmq.config.js';

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
    const broker = await rascal.BrokerAsPromised.create(rabbitmqConfig);

    const subscription = await broker.subscribe(subscriptions.balToBeautify);
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

      await broker.publish(publications.beautified, JSON.stringify(enriched), {
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
