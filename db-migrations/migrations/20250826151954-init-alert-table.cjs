'use strict'

require('dotenv').config()

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.createTable('revisions', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false,
          comment: 'ID technique de la ligne'
        },
        revisionId: {
          type: Sequelize.STRING(255),
          allowNull: false,
          comment: 'ID de la révision du dump-api'
        },
        cog: {
          type: Sequelize.STRING(5),
          allowNull: false,
          comment: 'Code commune (COG)'
        },
        districtName: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Nom de la commune'
        },
        districtId: {
          type: Sequelize.UUID,
          allowNull: true,
          comment: 'ID du district BAN'
        },
        status: {
          type: Sequelize.ENUM('success', 'error', 'warning', 'info'),
          allowNull: false,
          comment: 'Statut de traitement'
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Message brut complet'
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, {
        schema: 'ban',
        ifNotExists: true,
      })

      await queryInterface.createTable('subscribers', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
          allowNull: false
        },
        subscriptionName: {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: 'Nom optionnel donné par l\'utilisateur'
        },
        webhookUrl: {
          type: Sequelize.STRING(500),
          allowNull: false,
          unique: true,
          comment: 'URL de réception des webhooks'
        },
        districtsToFollow: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          allowNull: false,
          defaultValue: [],
          comment: 'Codes commune à suivre (vide = toutes)'
        },
        statusesToFollow: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          allowNull: false,
          defaultValue: ['error', 'warning'],
          comment: 'Statuts à suivre'
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        createdBy: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'sub utilisateur (optionnel)'
        },
        createdByEmail: {
          type: Sequelize.STRING,
          allowNull: true,
          comment: 'email utilisateur (optionnel)'
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, {
        schema: 'ban',
        ifNotExists: true,
      })

      // Grant permissions to ban user
      await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA ban TO "${POSTGRES_BAN_USER}";`)
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ban.revisions TO "${POSTGRES_BAN_USER}";`)
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ban.subscribers TO "${POSTGRES_BAN_USER}";`)
    } catch (error) {
      console.error('Erreur lors de la création des tables simplifiées:', error)
      throw error
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.subscribers CASCADE;')
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.revisions CASCADE;')
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS ban."enum_revisions_status" CASCADE;')
    } catch (error) {
      console.error('Erreur lors de la suppression des tables:', error)
      throw error
    }
  }
}
