import {Sequelize} from 'sequelize'
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

export const init = async () => {
  try {
    await sequelize.authenticate()
    console.log('Connection has been established successfully.')
  } catch (error) {
    console.error('Unable to connect to the database:', error)
  }
}