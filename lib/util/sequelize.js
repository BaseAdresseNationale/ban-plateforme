import fs from 'node:fs'
import {fileURLToPath} from 'node:url'
import path, {dirname} from 'node:path'
import {Sequelize, DataTypes} from 'sequelize'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const POSTGRES_PORT = process.env.POSTGRES_PORT || 5432

// Create a new Sequelize instance
export const sequelize = new Sequelize(process.env.POSTGRES_DB, process.env.POSTGRES_BAN_USER, process.env.POSTGRES_BAN_PASSWORD, {
  host: process.env.POSTGRES_URL,
  port: POSTGRES_PORT,
  dialect: 'postgres',
  logging: false
})

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
  }
}, {
  schema: 'ban',
  tableName: 'district'
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
  }
}, {
  indexes: [
    {
      fields: ['districtID'],
    }
  ],
  schema: 'ban',
  tableName: 'common_toponym'
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
  }
}, {
  indexes: [
    {
      fields: ['mainCommonToponymID'],
    },
    {
      fields: ['secondaryCommonToponymIDs'],
    },
    {
      fields: ['districtID'],
    },
    {
      fields: ['certified'],
    },
  ],
  schema: 'ban',
  tableName: 'address'
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
}, {
  schema: 'ban',
  tableName: 'job_status'
})

export const ContoursPostaux = sequelize.define('ContoursPostaux', {
  cog: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  geom: {
    type: DataTypes.GEOMETRY,
    allowNull: false,
  },
  codePostal: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  schema: 'external',
  tableName: 'contours_postaux',
})

export const init = async () => {
  try {
    await sequelize.authenticate()
    console.log('Connection has been established successfully.')

    await sequelize.sync()
    // Create views
    const addressViewQuery = fs.readFileSync(path.join(__dirname, './views/address_view.sql'), 'utf8')
    await sequelize.query(addressViewQuery)
    const commonToponymViewQuery = fs.readFileSync(path.join(__dirname, './views/common_toponym_view.sql'), 'utf8')
    await sequelize.query(commonToponymViewQuery)
    console.log('All models were synchronized successfully.')
  } catch (error) {
    console.error('Unable to connect to the database:', error)
  }
}
