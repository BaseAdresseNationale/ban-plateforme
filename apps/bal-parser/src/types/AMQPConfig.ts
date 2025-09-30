import { VhostConfig } from './vHostConfig.js';

export interface AMQPConfig {
  vhosts: {
    '/': VhostConfig;
  };
  subscriptions: {
    balUploaded: { queue: string };
  };
  publications: {
    balParsed: {
      exchange: string;
      routingKey: string;
    };
  };
}