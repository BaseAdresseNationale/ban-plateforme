import {DataTypes} from 'sequelize'
import {sequelize} from '../../util/sequelize.js' // Ajustez le chemin selon votre config

export const RevisionStatus = sequelize.define('RevisionStatus', {
  revisionId: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
    comment: 'ID de la révision (clé primaire)'
  },
  codeCommune: {
    type: DataTypes.STRING(5),
    allowNull: false
  },
  communeName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nom de la commune pour faciliter les recherches'
  },
  submissionDate: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'Date de soumission de cette révision'
  },
  status: {
    type: DataTypes.ENUM('success', 'error', 'warning', 'info'),
    allowNull: false,
    comment: 'Statut global de la révision'
  },
  isIntegratedInBan: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Cette révision est-elle actuellement dans la BAN ?'
  },
  integrationDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date d\'intégration dans la BAN (si applicable)'
  },
  errorType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Type d\'erreur principal'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Message d\'erreur/warning principal'
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Tous les détails : erreurs, seuils, statistiques, logs, etc.'
  },
  notificationsSent: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: [],
    comment: 'Array des IDs subscribers qui ont été notifiés + status'
  }
}, {
  schema: 'ban',
  tableName: 'revision_status',
  indexes: [
    {
      fields: ['codeCommune', 'submissionDate'],
      name: 'idx_commune_date'
    },
    {
      fields: ['isIntegratedInBan']
    },
    {
      fields: ['status']
    }
  ]
})

export const AlertSubscriber = sequelize.define('AlertSubscriber', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false
  },
  identifier: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'Identifiant libre choisi par l\'utilisateur'
  },
  webhookUrl: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'URL de réception des webhooks'
  },
  communesToFollow: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
    comment: 'Liste des codes commune à suivre (vide = toutes)'
  },
  statusesToFollow: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: ['error', 'warning'],
    comment: 'Liste des statuts à suivre'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  lastNotificationAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  failedAttemptsCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  config: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Config avancée : retry policy, timeout, filtres custom, etc.'
  }
}, {
  schema: 'ban',
  tableName: 'alert_subscribers',
  indexes: [
    {
      fields: ['identifier'],
      unique: true
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['communesToFollow'],
      using: 'gin'
    }
  ]
})