import {DataTypes} from 'sequelize'
import {sequelize} from '../../util/sequelize.js'

export const Revision = sequelize.define('Revision', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
    comment: 'ID technique de la ligne'
  },
  revisionId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'ID de la révision du dump-api'
  },
  cog: {
    type: DataTypes.STRING(5),
    allowNull: false,
    comment: 'Code commune (COG)'
  },
  districtName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Nom de la commune'
  },
  districtId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID du district BAN'
  },
  status: {
    type: DataTypes.ENUM('success', 'error', 'warning', 'info'),
    allowNull: false,
    comment: 'Statut de traitement'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Message brut complet'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  schema: 'ban',
  tableName: 'revisions',
  updatedAt: false // Pas de updatedAt, juste createdAt
})

export const Subscriber = sequelize.define('Subscriber', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false
  },
  webhookUrl: {
    type: DataTypes.STRING(500),
    allowNull: false,
    unique: true,
    comment: 'URL de réception des webhooks'
  },
  districtsToFollow: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
    comment: 'Codes commune à suivre (vide = toutes)'
  },
  statusesToFollow: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: ['error', 'warning'],
    comment: 'Statuts à suivre'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  schema: 'ban',
  tableName: 'subscribers',
  updatedAt: false // Pas de updatedAt, juste createdAt
})