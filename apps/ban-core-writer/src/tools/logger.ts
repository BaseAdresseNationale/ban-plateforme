import { env } from '@ban/config';

const NODE_ENV = (env as any).NODE_ENV || process.env.NODE_ENV || 'development';

// TODO : Prefer a logging library like Winston or Pino for more advanced logging features.
// TODO : Share as Package for reuse in other apps.

// Niveau	Valeur	Usage typique, basé sur "npm log levels"
// error	0	Erreurs critiques, échecs du service
// warn	1	Problèmes potentiels, avertissements
// info	2	Messages opérationnels généraux (ex. : démarrage du serveur)
// http	3	Journalisation des requêtes HTTP (ex. : GET /api/users 200)
// verbose	4	Détails sur le comportement de l'application
// debug	5	Informations de débogage (valeurs de variables, appels de fonctions)
// silly	6	Logs très granulaires, de priorité la plus basse
const DEBUG_LOG_LEVELS = {
    SILENT: 0,
    INFO: 1,
    VERBOSE: 2,
}

/**
 * 
 * Get the debug mode value from environment variable (DEBUG_LEVEL) or forced value.
 * Legal values are :  
 * `0` : silent  
 * `1` : info  
 * `2` : verbose  
 * @param forceValue number | undefined - optional forced debug mode value.
 * @returns number - debug mode value
 */
const getDebugMode = (forceValue?: number): number => {
    const legalValuesRaw = Object.entries(DEBUG_LOG_LEVELS).reduce((acc, [key, value]) => {
        acc[value as number] = key.toLowerCase();
        return acc;
    }, {} as Record<number, string>);
  const legalValues: number[] = Object.keys(legalValuesRaw).map(k => Number(k));
  const envDebugMode = forceValue ?? (env as any).DEBUG_LEVEL;
  let parsed: any;
  if (envDebugMode !== undefined && envDebugMode !== null) {
      const toParsed = Number(envDebugMode);
      if (!isNaN(toParsed)) {
          parsed = toParsed;
        }
    }
    if (parsed !== undefined) {
        if (legalValues.includes(parsed)) {
            if(parsed > 0) {
                console.log(`#️⃣  >> DEBUG LEVEL set to ${parsed} (${legalValuesRaw[parsed as keyof typeof legalValuesRaw]})`);
            }
            return parsed;
        } else {
            console.warn(`⚠️  WARNING: Invalid DEBUG_LEVEL value "${parsed}", defaulting to ${NODE_ENV === 'production' ? 0 : 1}`);
        }
    }

    if(NODE_ENV !== 'production') {
        console.log(`#️⃣  >> DEBUG LEVEL defaulting to 1 (info) as NODE_ENV is not "production"`);
        return 1;
    }

    // production mode without valid debug mode
    return 0;
}

const DEBUG_LEVEL = getDebugMode();

const logger = {
  // Level 0 - silent
  log: (...args: any[]) => {
    console.log(...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`⚠️  WARNING: ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`❌  ERROR: ${message}`, ...args);
  },

  // Level 1 - info
  info: (message: string, ...args: any[]) => {
    if (DEBUG_LEVEL >= 1) {
      console.info(`ℹ️  INFO: ${message}`, ...args);
    }
  },

  // Level 2 - verbose
  dir: (obj: any, options?: { depth: number | null }) => {
    if (DEBUG_LEVEL >= 2) {
        console.dir(obj, options);
    }
  },
  verbose: (message: string, ...args: any[]) => {
    if (DEBUG_LEVEL >= 2) {
      console.log(`🔍  VERBOSE: ${message}`, ...args);
    }
  },
};

export default logger;
