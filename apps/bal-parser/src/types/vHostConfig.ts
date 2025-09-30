export interface VhostConfig {
  connection: {
    protocol: string;
    hostname: string;
    port: number;
    user: string;
    password: string;
  };
  exchanges: Array<{
    name: string;
    type: 'topic';
  }>;
  queues: Array<{
    name: string;
    assert: boolean;
  }>;
  bindings: Array<{
    source: string;
    destination: string;
    bindingKey: string;
  }>;
}
