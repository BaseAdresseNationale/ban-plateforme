'use strict'

require('dotenv').config()

module.exports = {
  development: {
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DBNAME,
    host: process.env.POSTGRES_URL,
    port: 5432,
    dialect: 'postgres',
  },
  production: {
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DBNAME,
    host: process.env.POSTGRES_URL,
    port: 5432,
    dialect: 'postgres',
  }
}
