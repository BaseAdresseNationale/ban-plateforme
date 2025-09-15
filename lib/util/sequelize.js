import {Sequelize, DataTypes} from 'sequelize'

const {POSTGRES_BAN_USER, POSTGRES_BAN_PASSWORD, POSTGRES_DB, POSTGRES_URL} = process.env
const POSTGRES_PORT = process.env.POSTGRES_PORT || 5432

// Create a new Sequelize instance
/* eslint-disable unicorn/numeric-separators-style */
export const sequelize = new Sequelize(POSTGRES_DB, POSTGRES_BAN_USER, POSTGRES_BAN_PASSWORD, {
  host: POSTGRES_URL,
  port: POSTGRES_PORT,
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 20,
    min: 0,
    acquire: 60000,
    idle: 5000
  }
})
/* eslint-enable unicorn/numeric-separators-style */
export const District = sequelize.define('District', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
  },
  labels: {
    type: DataTypes.ARRAY(DataTypes.JSONB),
    allowNull: false,
  },
  updateDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  config: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  meta: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  range_validity: { // eslint-disable-line camelcase
    type: DataTypes.RANGE(DataTypes.DATE),
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  schema: 'ban',
  tableName: 'district',
  timestamps: false
})

export const CommonToponym = sequelize.define('CommonToponym', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
  },
  districtID: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: District,
      key: 'id'
    }
  },
  labels: {
    type: DataTypes.ARRAY(DataTypes.JSONB),
    allowNull: false,
  },
  geometry: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  updateDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  meta: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  range_validity: { // eslint-disable-line camelcase
    type: DataTypes.RANGE(DataTypes.DATE),
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  schema: 'ban',
  tableName: 'common_toponym',
  timestamps: false
})

export const Address = sequelize.define('Address', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
  },
  mainCommonToponymID: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: CommonToponym,
      key: 'id'
    }
  },
  secondaryCommonToponymIDs: {
    type: DataTypes.ARRAY(DataTypes.UUID),
  },
  districtID: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: District,
      key: 'id'
    }
  },
  number: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  suffix: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  labels: {
    type: DataTypes.ARRAY(DataTypes.JSONB),
    allowNull: true,
  },
  certified: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  positions: {
    type: DataTypes.ARRAY(DataTypes.JSONB),
    allowNull: false,
  },
  updateDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  meta: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  range_validity: { // eslint-disable-line camelcase
    type: DataTypes.RANGE(DataTypes.DATE),
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  schema: 'ban',
  tableName: 'address',
  timestamps: false
})

export const JobStatus = sequelize.define('JobStatus', {
  id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  dataType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  jobType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  count: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  message: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  report: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  }
}, {
  schema: 'ban',
  tableName: 'job_status'
})

export const Certificate = sequelize.define('Certificate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  address_id: { // eslint-disable-line camelcase
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'address',
      key: 'id',
    },
  },
  // eslint-disable-next-line camelcase
  full_address: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  // eslint-disable-next-line camelcase
  cadastre_ids: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW,
  }
}, {
  schema: 'ban',
  tableName: 'certificate',
  timestamps: false,
})

export const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  sub: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  name: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  givenName: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  familyName: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  usualName: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  email: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  siret: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  aud: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  exp: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  iat: {
    type: Sequelize.BIGINT,
    allowNull: false,
  },
  iss: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  createdAt: {
    type: Sequelize.DATE,
    allowNull: false,
  },
  updatedAt: {
    type: Sequelize.DATE,
    allowNull: false,
  }
}, {
  schema: 'ban',
  tableName: 'session',
  timestamps: false,
})

export const Action = sequelize.define('Action', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  districtID: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: District,
      key: 'id'
    }
  },
  status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  label: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  siren: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  sessionID: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Session,
      key: 'id'
    }
  },
  createdAt: {
    type: Sequelize.DATE,
    allowNull: false,
  },
  updatedAt: {
    type: Sequelize.DATE,
    allowNull: false,
  }
}, {
  schema: 'ban',
  tableName: 'action',
  timestamps: false,
})

export const Datanova = sequelize.define('Datanova', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  inseeCom: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  postalCodes: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
  },
  libelleAcheminementWithPostalCodes: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'external',
  tableName: 'datanova',
  timestamps: true,
})

export const PostalArea = sequelize.define('PostalArea', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  postalCode: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  inseeCom: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  geometry: {
    type: DataTypes.GEOMETRY,
    allowNull: false,
  },
}, {
  schema: 'external',
  tableName: 'postal_area',
  timestamps: true,
})

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
  subscriptionName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Nom optionnel donné par l\'utilisateur'
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
    defaultValue: true,
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'sub utilisateur (optionnel)'
  },
  createdByEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'email utilisateur (optionnel)'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  }
}, {
  schema: 'ban',
  tableName: 'subscribers',
  updatedAt: false
})

export const init = async () => {
  try {
    await sequelize.authenticate()
    console.log('Connection has been established successfully.')
  } catch (error) {
    console.error('Unable to connect to the database:', error)
  }
}
