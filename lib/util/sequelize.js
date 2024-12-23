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

export const init = async () => {
  try {
    await sequelize.authenticate()
    console.log('Connection has been established successfully.')
  } catch (error) {
    console.error('Unable to connect to the database:', error)
  }
}
