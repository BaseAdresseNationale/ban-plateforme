'use strict'

require('dotenv').config()

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Create ban schema if not exists
      await queryInterface.sequelize.query('CREATE SCHEMA IF NOT EXISTS ban;')

      // Grant permissions to ban user on schema ban
      await queryInterface.sequelize.query(
        `GRANT USAGE ON SCHEMA ban TO "${POSTGRES_BAN_USER}";`
      )

      // Create Certificate Table if not exists
      await queryInterface.createTable(
        'certificate',
        {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false,
            primaryKey: true,
          },
          // eslint-disable-next-line camelcase
          address_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: {
                tableName: 'address',
                schema: 'ban',
              },
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          // eslint-disable-next-line camelcase
          full_address: {
            type: Sequelize.JSONB,
            allowNull: false,
          },
          // eslint-disable-next-line camelcase
          cadastre_ids: {
            type: Sequelize.ARRAY(Sequelize.STRING),
            allowNull: true,
          },
          createdAt: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
        },
        {
          schema: 'ban',
          timestamps: false,
          ifNotExists: true,
        }
      )

      // Grant permissions to ban user on the certificate table
      await queryInterface.sequelize.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ban.certificate TO "${POSTGRES_BAN_USER}";`
      )
    } catch (error) {
      console.error(error)
    }
  },

  async down(queryInterface) {
    try {
      // Drop the Certificate table
      await queryInterface.sequelize.query(
        'DROP TABLE IF EXISTS ban.certificate CASCADE;'
      )
    } catch (error) {
      console.error(error)
    }
  },
}
