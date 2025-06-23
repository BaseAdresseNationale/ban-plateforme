'use strict'

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Grant permissions to ban user on shema ban
      await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA ban TO "${POSTGRES_BAN_USER}";`)

      // Create District Table if not exists
      await queryInterface.createTable('action', {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
        },
        districtID: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        status: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
        },
        label: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        siren: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        siret: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        firstName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        lastName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        email: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        }
      }, {
        schema: 'ban',
        ifNotExists: true,
      })

      // Grant permissions to ban user
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ban TO "${POSTGRES_BAN_USER}";`)
    } catch (error) {
      console.log(error)
    }
  },

  async down(queryInterface) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    try {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.action CASCADE;')
    } catch (error) {
      console.error(error)
    }
  }
}
