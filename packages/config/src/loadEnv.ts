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
  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.string(),
  POSTGRES_DB: z.string(),
  POSTGRES_BAN_USER: z.string(),
  POSTGRES_BAN_PASSWORD: z.string(),
  POSTGRES_ROOT_USER: z.string(),
  POSTGRES_ROOT_PASSWORD: z.string(),
  POSTGRES_URI: z.string(),
  POSTGRES_DATA_PATH: z.string(),
  MONGO_HOST: z.string(),
  MONGO_PORT: z.string(),
  MONGO_DB: z.string(),
  MONGO_USER: z.string().optional().default(''),
  MONGO_PASSWORD: z.string().optional().default(''),
  RABBITMQ_HOST: z.string(),
  RABBITMQ_PORT: z.string(),
  RABBITMQ_USER: z.string(),
  RABBITMQ_PASSWORD: z.string(),
});

// Valider les variables d'environnement
envSchema.parse(process.env);

export const env = {
  PG: {
    host: process.env.POSTGRES_HOST!,
    port: parseInt(process.env.POSTGRES_PORT!, 10),
    db: process.env.POSTGRES_DB!,
    user: process.env.POSTGRES_BAN_USER!,
    password: process.env.POSTGRES_BAN_PASSWORD!,
    rootUser: process.env.POSTGRES_ROOT_USER!,
    rootPassword: process.env.POSTGRES_ROOT_PASSWORD!,
    url: process.env.POSTGRES_URI!,
    dataPath: process.env.POSTGRES_DATA_PATH!,
  },
  MONGO: {
    host: process.env.MONGO_HOST!,
    port: parseInt(process.env.MONGO_PORT!, 10),
    db: process.env.MONGO_DB!,
    username: process.env.MONGO_USER,
    password: process.env.MONGO_PASSWORD,
  },
  RABBIT: {
    host: process.env.RABBITMQ_HOST!,
    port: parseInt(process.env.RABBITMQ_PORT!, 10),
    user: process.env.RABBITMQ_USER!,
    password: process.env.RABBITMQ_PASSWORD!,
  }
};

console.log('[config] Validation des variables réussie ✅');
