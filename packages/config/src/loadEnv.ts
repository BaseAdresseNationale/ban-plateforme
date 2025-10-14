import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Résoudre le chemin absolu du fichier
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger le fichier .env depuis la racine du monorepo
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log('[config] Variables chargées depuis .env');

// Définir le schéma attendu pour valider les variables d'environnement
const envSchema = z.object({
  PG_HOST: z.string(),
  PG_PORT: z.string(),
  PG_DB: z.string(),
  PG_USER: z.string(),
  PG_PASSWORD: z.string(),
  MONGO_HOST: z.string(),
  MONGO_PORT: z.string(),
  MONGO_DB: z.string(),
  RABBITMQ_HOST: z.string(),
  RABBITMQ_PORT: z.string(),
  RABBITMQ_USER: z.string(),
  RABBITMQ_PASSWORD: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_REGION: z.string(),
  S3_ENDPOINT: z.string(),
  S3_BUCKETNAME: z.string(),
  S3_MAXKEYS: z.string(),
});

// Valider les variables d'environnement
envSchema.parse(process.env);

export const env = {
  PG: {
    host: process.env.PG_HOST!,
    port: parseInt(process.env.PG_PORT!, 10),
    db: process.env.PG_DB!,
    user: process.env.PG_USER!,
    password: process.env.PG_PASSWORD!,
  },
  MONGO: {
    host: process.env.MONGO_HOST!,
    port: parseInt(process.env.MONGO_PORT!, 10),
    db: process.env.MONGO_DB!,
  },
  RABBIT: {
    host: process.env.RABBITMQ_HOST!,
    port: parseInt(process.env.RABBITMQ_PORT!, 10),
    user: process.env.RABBITMQ_USER!,
    password: process.env.RABBITMQ_PASSWORD!,
  },
  S3: {
    access_key_id: process.env.S3_ACCESS_KEY_ID,
    secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    bucketname: process.env.S3_BUCKETNAME,
    maxkeys: process.env.S3_MAXKEYS,
  }
};

console.log('[config] Validation des variables réussie ✅');
