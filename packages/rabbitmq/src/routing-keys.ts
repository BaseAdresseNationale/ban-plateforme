export const routingKeys = {
  balUploaded: 'bal.uploaded',
  balParsed: 'bal.parsed',
  balEnrich: 'bal.enrich',
  balBeautified: 'bal.enriched.beautifier',
  balEnrichedTargetKey: 'bal.enriched.target-key',
  balEnrichedOldDistrict: 'bal.enriched.old-district',
  balEnrichedAll: 'bal.enriched.*',
  balReady: 'bal.ready',
  exportRequested: 'export.requested',
  exportCompleted: 'export.completed',
  exportFailed: 'export.failed',
  retryAll: '#',
  deadLetterAll: '#',
} as const;

export const RABBITMQ_ROUTING_KEYS = routingKeys;

export type RabbitMqRoutingKey =
  typeof routingKeys[keyof typeof routingKeys];
