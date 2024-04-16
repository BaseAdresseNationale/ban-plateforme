'use strict'

require('dotenv').config()

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    try {
      await queryInterface.sequelize.query(`REVOKE DELETE ON ban.address FROM "${POSTGRES_BAN_USER}"`)
      await queryInterface.sequelize.query(`REVOKE DELETE ON ban.common_toponym FROM "${POSTGRES_BAN_USER}"`)
      await queryInterface.sequelize.query(`REVOKE DELETE ON ban.district FROM "${POSTGRES_BAN_USER}"`)
    } catch (error) {
      console.log(error)
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.sequelize.query(`GRANT DELETE ON ban.address TO "${POSTGRES_BAN_USER}"`)
      await queryInterface.sequelize.query(`GRANT DELETE ON ban.common_toponym TO "${POSTGRES_BAN_USER}"`)
      await queryInterface.sequelize.query(`GRANT DELETE ON ban.district TO "${POSTGRES_BAN_USER}"`)
    } catch (error) {
      console.log(error)
    }
  }
}
