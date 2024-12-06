'use strict'

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`GRANT USAGE, SELECT, UPDATE ON SEQUENCE external.postal_area_id_seq TO "${POSTGRES_BAN_USER}";`)
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`REVOKE USAGE, SELECT, UPDATE ON SEQUENCE external.postal_area_id_seq FROM "${POSTGRES_BAN_USER}";`)
  }
}
