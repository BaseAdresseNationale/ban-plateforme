/* eslint-disable no-unused-vars */
export enum ErrorType {
  // Validation BAL
  MISSING_DATA = 'MISSING_DATA',
  INVALID_FORMAT = 'INVALID_FORMAT', 
  MIXED_IDS = 'MIXED_IDS',
  
  // Autorisation
  UNAUTHORIZED = 'UNAUTHORIZED',
  MISSING_RIGHTS = 'MISSING_RIGHTS',
  
  // Seuils et limites
  DELETION_THRESHOLD = 'DELETION_THRESHOLD',
  
  // Jobs et traitement
  JOB_FAILURE = 'JOB_FAILURE',
  JOB_TIMEOUT = 'JOB_TIMEOUT',
  
  // APIs externes
  BAN_API_ERROR = 'BAN_API_ERROR',
  DUMP_API_ERROR = 'DUMP_API_ERROR',
  LEGACY_API_ERROR = 'LEGACY_API_ERROR',
  
  // Système
  NO_DISTRICT_FOUND = 'NO_DISTRICT_FOUND',
  WHITELIST = 'WHITELIST',
   ALREADY_EXISTS = 'ALREADY_EXISTS',
}

// STATUT WEBHOOK
export enum Status {
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning', 
  ERROR = 'error'
}

// EMOJIS CONSISTANTS
const ICONS = {
  SUCCESS: '✅',
  INFO: 'ℹ️',
  WARNING: '⚠️',
  ERROR: '❌',
  BLOCKED: '⛔️'
} as const

export const MessageCatalog = {

  // ===== SUCCESS =====
  SUCCESS: {
    DISTRICT_PROCESSED: {
      type: ErrorType.BAN_API_ERROR,
      status: Status.SUCCESS,
      template: (districtId: string, cog: string) => 
        `${ICONS.SUCCESS} District ${districtId} (cog: ${cog}) traité avec succès et mis à jour dans la base BAN`
    },

    JOB_COMPLETED: {
      type: ErrorType.JOB_FAILURE,
      status: Status.SUCCESS,
      template: (statusId: string, seconds: number) => 
        `Job ${statusId} terminé avec succès après ${seconds}s`
    },

    ALL_JOBS_COMPLETED: {
      type: ErrorType.JOB_FAILURE,
      status: Status.SUCCESS,
      template: (jobCount: number, districtId: string) => 
        `Tous les ${jobCount} jobs terminés avec succès pour le district ${districtId}`
    }
  },

  // ===== INFO =====
  INFO: {
    NOT_WHITELISTED: {
      type: ErrorType.WHITELIST,
      status: Status.INFO,
      template: (cog: string) => 
        `Le département ou district cog ${cog} ne fait pas partie de la liste blanche : Enregistrement de la BAL sans les identifiants....`
    },

    WHITELISTED: {
      type: ErrorType.WHITELIST,
      status: Status.INFO,
      template: (cog: string) => 
        `Le district cog ${cog} fait partie de la liste blanche.`
    },

    BAL_VERSION: {
      type: ErrorType.INVALID_FORMAT,
      status: Status.INFO,
      template: (cog: string, version: string) => 
        `Le district cog ${cog} utilise la version BAL ${version}`
    },

    NO_BAN_ID: {
      type: ErrorType.INVALID_FORMAT,
      status: Status.INFO,
      template: (cog: string) => 
        `${ICONS.INFO} Le district cog: ${cog} n'utilise pas de BanID : Enregistrement de la BAL sans les identifiants....`
    },

    USES_BAN_ID: {
      type: ErrorType.INVALID_FORMAT,
      status: Status.INFO,
      template: (cog: string) => 
        `Le district cog: ${cog} utilise des banID`
    },

    NO_CHANGES: {
      type: ErrorType.BAN_API_ERROR,
      status: Status.INFO,
      template: (districtId: string, cog: string) => 
        `${ICONS.INFO} District id ${districtId} (cog: ${cog}) non mis à jour dans la BDD BAN. Aucun changement détecté.`
    },

    DISTRICT_UPDATED: {
      type: ErrorType.BAN_API_ERROR,
      status: Status.INFO,
      template: (districtId: string, cog: string, responseBody: string) => 
        `District id ${districtId} (cog: ${cog}) mis à jour dans la BDD BAN. Corps de réponse : ${responseBody}`
    },

      PROCESSING_STATISTICS: {
      type: ErrorType.BAN_API_ERROR,
      status: Status.INFO,
      template: (districtId: string, addressStats: {toAdd: number, toUpdate: number, toDelete: number}, toponymStats: {toAdd: number, toUpdate: number, toDelete: number}) => {
        const addressTotal = addressStats.toAdd + addressStats.toUpdate + addressStats.toDelete;
        const toponymTotal = toponymStats.toAdd + toponymStats.toUpdate + toponymStats.toDelete;
        
        return `${ICONS.INFO} Traitement du district ${districtId}:\n` +
               `Adresses: ${addressStats.toAdd} ajouts, ${addressStats.toUpdate} modifications, ${addressStats.toDelete} suppressions\n` +
               `Toponymes: ${toponymStats.toAdd} ajouts, ${toponymStats.toUpdate} modifications, ${toponymStats.toDelete} suppressions`;
      }
    },

    CHECKING_JOBS: {
      type: ErrorType.JOB_FAILURE,
      status: Status.INFO,
      template: (jobCount: number, districtId: string) => 
        `Vérification de ${jobCount} job(s) pour le district ${districtId} en parallèle...`
    },

    JOB_PENDING: {
      type: ErrorType.JOB_FAILURE,
      status: Status.INFO,
      template: (statusId: string, attempt: number, maxAttempts: number) => 
        `Job ${statusId} en attente... (tentative ${attempt}/${maxAttempts})`
    }
  },

  // ===== WARNING =====
  WARNING: {
    LEGACY_WITH_ERROR: {
      type: ErrorType.INVALID_FORMAT,
      status: Status.WARNING,
      template: (cog: string, errorDetails: string) => 
        `${ICONS.WARNING} **Enregistrement de la BAL sans les identifiants**\n${errorDetails}`
    },

    DELETION_THRESHOLD_SOON: {
      type: ErrorType.DELETION_THRESHOLD,
      status: Status.WARNING,
      template: (cog: string, districtInfo: string, errorMessage: string) => 
        `${districtInfo}\n${ICONS.WARNING} ** La BAL ${cog} sera bientôt bloquée -- Changements d'ID détectés **\n${errorMessage}`
    }
  },

  // ===== ERROR =====
  ERROR: {
    NO_DISTRICT_FOUND: {
      type: ErrorType.NO_DISTRICT_FOUND,
      status: Status.ERROR,
      template: (cog: string) => 
        `Aucun district trouvé avec le cog ${cog}`
    },

    BAL_BLOCKED: {
      type: ErrorType.ALREADY_EXISTS,
      status: Status.ERROR,
      template: (cog: string, districtInfo: string, errorMessage: string) => 
        `${districtInfo}\n${ICONS.BLOCKED} BAL ${cog} bloquée - **Le district est enregistré dans le nouveau système avec identifiants**\n${errorMessage}`
    },
  
    BAL_NO_BAN_ID_DISTRICT_EXISTS: {
      type: ErrorType.INVALID_FORMAT,
      status: Status.ERROR,
      template: (cog: string, districtInfo: string) => 
        `${districtInfo}\n${ICONS.BLOCKED} BAL ${cog} bloquée - **Le district est enregistré dans le nouveau système avec identifiants \n districtID manquant**`
    },

    DELETION_THRESHOLD_EXCEEDED: {
      type: ErrorType.DELETION_THRESHOLD,
      status: Status.ERROR,
      template: (districtId: string, threshold: number, details: string) => 
        `**Seuil de suppression dépassé**\nBAL du district ID: \`${districtId}\`\nSeuil: ${threshold}%\n${details}`
    },

    UNAUTHORIZED_OPERATION: {
      type: ErrorType.UNAUTHORIZED,
      status: Status.ERROR,
      template: (districtId: string, unauthorizedAddresses: string[], unauthorizedToponyms: string[]) => 
        `**Opération non autorisée -Les éléments font partie d'un district différent : Adresses non autorisées : \`${unauthorizedAddresses.join(', ')}\` - Toponymes non autorisés : \`${unauthorizedToponyms.join(', ')}\`- BAL du district ID : \`${districtId}\`**`
    },

    MISSING_RIGHTS: {
      type: ErrorType.MISSING_RIGHTS,
      status: Status.ERROR,
      template: (unauthorizedIds: string[]) => 
        `**Droits manquants, Les districtIDs ${unauthorizedIds.join(', ')} ne font pas partie des districts autorisés à être mis à jour**`
    },

    MISSING_DISTRICT_ID: {
      type: ErrorType.MISSING_DATA,
      status: Status.ERROR,
      template: (districtId: string, cog: string, balAdresse: any) => 
        `**districtID manquant** \nBAL du district ID : \`${districtId}\` (cog : \`${cog}\`) \nDétail de la ligne d'adresse BAL : \n\`\`\`JSON\n${JSON.stringify(balAdresse, null, 2)}\n\`\`\``
    },

    MISSING_MAIN_TOPO_ID: {
      type: ErrorType.MISSING_DATA,
      status: Status.ERROR,
      template: (districtId: string, cog: string, balAdresse: any) => 
        `**mainTopoID manquant** \nBAL du district ID : \`${districtId}\` (cog : \`${cog}\`) \nDétail de la ligne d'adresse BAL : \n\`\`\`JSON\n${JSON.stringify(balAdresse, null, 2)}\n\`\`\``
    },

    MISSING_ADDRESS_ID: {
      type: ErrorType.MISSING_DATA,
      status: Status.ERROR,
      template: (districtId: string, cog: string, balAdresse: any) => 
        `**addressID manquant** \nBAL du district ID : \`${districtId}\` (cog : \`${cog}\`) \nDétail de la ligne d'adresse BAL : \n\`\`\`JSON\n${JSON.stringify(balAdresse, null, 2)}\n\`\`\``
    },

    MIXED_ID_USAGE: {
      type: ErrorType.MIXED_IDS,
      status: Status.ERROR,
      template: (cog: string) => 
        `**IDs manquants** \nBAL du cog : \`${cog}\` \nCertaines lignes d'adresse BAL utilisent des BanIDs et d'autres non`
    },

    JOB_FAILED: {
      type: ErrorType.JOB_FAILURE,
      status: Status.ERROR,
      template: (statusId: string, errorMessage: string) => 
        `**Job ${statusId} échoué : ${errorMessage}**`
    },

    JOB_TIMEOUT: {
      type: ErrorType.JOB_TIMEOUT,
      status: Status.ERROR,
      template: (statusId: string, maxWaitMinutes: number) => 
        `**Job ${statusId} timeout après ${maxWaitMinutes} minutes**`
    },

    JOB_UNKNOWN_STATUS: {
      type: ErrorType.JOB_FAILURE,
      status: Status.ERROR,
      template: (statusId: string, status: string) => 
        `**Job ${statusId} statut inconnu : ${status}**`
    },

    BAN_API_ERROR: {
      type: ErrorType.BAN_API_ERROR,
      status: Status.ERROR,
      template: (message: string) => 
        `**API BAN - ${message}**`
    },

    BAN_LEGACY_API_ERROR: {
      type: ErrorType.LEGACY_API_ERROR,
      status: Status.ERROR,
      template: (message: string) => 
        `**API BAN legacy - ${message}**`
    },

    DUMP_API_ERROR: {
      type: ErrorType.DUMP_API_ERROR,
      status: Status.ERROR,
      template: (operation: string, message: string, url: string) => 
        `**API Dump - ${operation} - ${message} (${url})**`
    },

    DISTRICT_ERROR: {
      type: ErrorType.BAN_API_ERROR,
      status: Status.ERROR,
      template: (districtId: string, cog: string, message: string) => 
        `**Erreur pour le district ${districtId} (cog: ${cog}) : ${message}**`
    }
  }
} as const

// HELPERS UTILITAIRES
export const DistrictInfoBuilder = {
  fromDistricts: (districts: any[]) => 
    districts.map(({ id, labels, meta }) => 
      `${labels[0].value} (${meta?.insee.cog} / ${id})`
    ).join(", "),
    
  single: (name: string, cog: string, id: string) => 
    `${name} (${cog} / ${id})`
}

export const createWebhookData = (
  messageTemplate: (...args: any[]) => string,
  status: Status,
  revisionId?: string,
  cog?: string,
  districtName?: string,
  districtId?: string
) => ({
  message: messageTemplate,
  status,
  revisionId,
  cog,
  districtName,
  districtId
})

export const getMessagesByType = () => {
  const stats = {
    SUCCESS: Object.keys(MessageCatalog.SUCCESS).length,
    INFO: Object.keys(MessageCatalog.INFO).length,
    WARNING: Object.keys(MessageCatalog.WARNING).length,
    ERROR: Object.keys(MessageCatalog.ERROR).length
  }
  
  const total = Object.values(stats).reduce((sum, count) => sum + count, 0)
  
  return {
    ...stats,
    TOTAL: total,
    percentages: {
      SUCCESS: Math.round((stats.SUCCESS / total) * 100),
      INFO: Math.round((stats.INFO / total) * 100),
      WARNING: Math.round((stats.WARNING / total) * 100),
      ERROR: Math.round((stats.ERROR / total) * 100)
    }
  }
}

export const findMessagesByErrorType = (errorType: ErrorType) => {
  const results: Array<{category: string, key: string, template: Function}> = []
  
  Object.entries(MessageCatalog).forEach(([category, messages]) => {
    Object.entries(messages).forEach(([key, config]) => {
      if (config.type === errorType) {
        results.push({ category, key, template: config.template })
      }
    })
  })
  
  return results
}

export default MessageCatalog