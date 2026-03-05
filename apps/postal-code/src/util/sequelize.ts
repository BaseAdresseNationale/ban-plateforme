import {Sequelize, DataTypes} from 'sequelize'
import { env } from '@ban/config';

// Create a new Sequelize instance
/* eslint-disable unicorn/numeric-separators-style */
export const sequelize = new Sequelize(env.PG.db, env.PG.user, env.PG.password, {
  host: env.PG.host,
  port: env.PG.port,
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 20,
    min: 0,
    acquire: 60000,
    idle: 5000
  }
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
  schema: 'postal',
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
  schema: 'postal',
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