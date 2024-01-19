'use strict'

require('dotenv').config()

const {POSTGRES_ROOT_USER, POSTGRES_ROOT_PASSWORD, POSTGRES_DB, POSTGRES_URL, POSTGRES_PORT} = process.env

module.exports = {
  development: {
    username: POSTGRES_ROOT_USER,
    password: POSTGRES_ROOT_PASSWORD,
    database: POSTGRES_DB,
    host: POSTGRES_URL,
    port: POSTGRES_PORT,
    dialect: 'postgres',
  },
  production: {
    username: POSTGRES_ROOT_USER,
    password: POSTGRES_ROOT_PASSWORD,
    database: POSTGRES_DB,
    host: POSTGRES_URL,
    port: POSTGRES_PORT,
    dialect: 'postgres',
  }
}
