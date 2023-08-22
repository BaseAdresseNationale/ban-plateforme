import {Sequelize, DataTypes} from 'sequelize'

// Create a new Sequelize instance
const sequelize = new Sequelize(process.env.POSTGRES_DBNAME, process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, {
  host: process.env.POSTGRES_URL,
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
})

export const init = async () => {
  try {
    await sequelize.authenticate()
    console.log('Connection has been established successfully.')

    await sequelize.sync()
    console.log('All models were synchronized successfully.')
  } catch (error) {
    console.error('Unable to connect to the database:', error)
  }
}
