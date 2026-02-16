declare module "@ban/config" {
  /** Configuration Postgres */
  export type PGConfig = {
    host: string;
    port: number;
    db: string;
    user: string;
    password: string;
    rootUser: string;
    rootPassword: string;
    url: string;
    dataPath: string;
  };

  /** Configuration MongoDB */
  export type MongoConfig = {
    host: string;
    port: number;
    db: string;
  };

  /** Configuration RabbitMQ */
  export type RabbitConfig = {
    host: string;
    port: number;
    user: string;
    password: string;
  };

  /** Ensemble des variables d'environnement validées par le package `@ban/config` */
  export type Env = {
    PG: PGConfig;
    MONGO: MongoConfig;
    RABBIT: RabbitConfig;
    // Autorise d'autres clés additionnelles si présent
    [key: string]: any;
  };

  export const env: Env;
}
