'use strict'

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Grant permissions to ban user on shema ban
      await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA ban TO "${POSTGRES_BAN_USER}";`)

      // Create District Table if not exists
      await queryInterface.createTable('session', {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
        },
        sub: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        givenName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        familyName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        usualName: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        siret: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        aud: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        exp: {
          type: Sequelize.BIGINT,
          allowNull: false,
        },
        iat: {
          type: Sequelize.BIGINT,
          allowNull: false,
        },
        iss: {
          type: Sequelize.STRING,
          allowNull: false,
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
      })

      // Grant permissions to ban user
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ban.session TO "${POSTGRES_BAN_USER}";`)
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
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.session CASCADE;')
    } catch (error) {
      console.error(error)
    }
  }
}
