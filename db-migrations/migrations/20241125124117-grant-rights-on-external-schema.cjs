'use strict'

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA external TO "${POSTGRES_BAN_USER}";`)
    await queryInterface.sequelize.query(`GRANT ALL PRIVILEGES ON SCHEMA external TO "${POSTGRES_BAN_USER}";`)
    await queryInterface.sequelize.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA external TO "${POSTGRES_BAN_USER}";`)
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`REVOKE USAGE ON SCHEMA external FROM "${POSTGRES_BAN_USER}";`)
    await queryInterface.sequelize.query(`REVOKE ALL PRIVILEGES ON SCHEMA external FROM "${POSTGRES_BAN_USER}";`)
    await queryInterface.sequelize.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA external FROM "${POSTGRES_BAN_USER}";`)
  }
}
