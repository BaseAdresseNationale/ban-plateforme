const {env} = require('@ban/config')

module.exports={
  development: {
    username: env.PG.rootUser,
    password: env.PG.rootPassword,
    database: env.PG.db,
    host: env.PG.host,
    port: env.PG.port,
    dialect: 'postgres',
  },
  production: {
    username: env.PG.rootUser,
    password: env.PG.rootPassword,
    database: env.PG.db,
    host: env.PG.host,
    port: env.PG.port,
    dialect: 'postgres',
  }
}

