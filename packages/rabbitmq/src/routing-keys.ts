export const routingKeys = {
  balUploaded: 'bal.uploaded',
  balParsed: 'bal.parsed',
  balEnrich: 'bal.enrich',
  balBeautified: 'bal.enriched.beautifier',
  balEnrichedTargetKey: 'bal.enriched.target-key',
  balEnrichedOldDistrict: 'bal.enriched.old-district',
  balEnrichedAll: 'bal.enriched.*',
  balReady: 'bal.ready',
  retryAll: '#',
  deadLetterAll: '#',
} as const;

export const RABBITMQ_ROUTING_KEYS = routingKeys;

export type RabbitMqRoutingKey =
  typeof routingKeys[keyof typeof routingKeys];
