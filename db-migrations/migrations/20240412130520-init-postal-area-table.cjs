'use strict'

require('dotenv').config()

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Create external schema if not exists
      await queryInterface.sequelize.query('CREATE SCHEMA IF NOT EXISTS external;')
      // Grant permissions to ban user on schema external
      await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA external TO "${POSTGRES_BAN_USER}";`)

      // Create postal_area Table if not exists
      await queryInterface.createTable('postal_area', {
        postalCode: {
          type: Sequelize.STRING,
          allowNull: false,
          primaryKey: true,
        },
        geometry: {
          type: Sequelize.GEOMETRY,
          allowNull: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      }, {
        schema: 'external',
        ifNotExists: true,
      })

      // Grant permissions to ban user
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA external TO "${POSTGRES_BAN_USER}";`)
    } catch (error) {
      console.error(error)
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS external.postal_area CASCADE;')
      await queryInterface.sequelize.query('DROP SCHEMA IF EXISTS external;')
    } catch (error) {
      console.error(error)
    }
  }
}
