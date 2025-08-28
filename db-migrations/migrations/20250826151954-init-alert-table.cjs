'use strict'

require('dotenv').config()

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Table principale : toutes les révisions avec leurs statuts/erreurs
      await queryInterface.createTable('revision_status', {
        revisionId: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          comment: 'ID de la révision (clé primaire)'
        },
        codeCommune: {
          type: Sequelize.STRING(5),
          allowNull: false,
          index: true,
        },
        communeName: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Nom de la commune pour faciliter les recherches'
        },
        submissionDate: {
          type: Sequelize.DATE,
          allowNull: false,
          index: true,
          comment: 'Date de soumission de cette révision'
        },
        status: {
          type: Sequelize.ENUM('success', 'error', 'warning', 'info'),
          allowNull: false,
          index: true,
          comment: 'Statut global de la révision'
        },
        isIntegratedInBan: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          index: true,
          comment: 'Cette révision est-elle actuellement dans la BAN ?'
        },
        integrationDate: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: 'Date d\'intégration dans la BAN (si applicable)'
        },
        errorType: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: 'Type d\'erreur principal'
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: 'Message d\'erreur/warning principal'
        },
        details: {
          type: Sequelize.JSONB,
          allowNull: true,
          comment: 'Tous les détails : erreurs, seuils, statistiques, logs, etc.'
        },
        notificationsSent: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: [],
          comment: 'Array des IDs subscribers qui ont été notifiés + status'
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
        indexes: [
          {
            fields: ['codeCommune', 'submissionDate'],
            name: 'idx_commune_date'
          },
          {
            fields: ['isIntegratedInBan'],
          },
          {
            fields: ['status'],
          }
        ],
        schema: 'ban',
        ifNotExists: true,
      })

      // Table des abonnés aux alertes
      await queryInterface.createTable('alert_subscribers', {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        identifier: {
          type: Sequelize.STRING(100),
          allowNull: false,
          unique: true,
          comment: 'Identifiant libre choisi par l\'utilisateur'
        },
        webhookUrl: {
          type: Sequelize.STRING(500),
          allowNull: false,
          comment: 'URL de réception des webhooks'
        },
        communesToFollow: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          allowNull: false,
          defaultValue: [],
          comment: 'Liste des codes commune à suivre (vide = toutes)'
        },
        statusesToFollow: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          allowNull: false,
          defaultValue: ['error', 'warning'],
          comment: 'Liste des statuts à suivre'
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        lastNotificationAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        failedAttemptsCount: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        config: {
          type: Sequelize.JSONB,
          allowNull: true,
          comment: 'Config avancée : retry policy, timeout, filtres custom, etc.'
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
        indexes: [
          {
            fields: ['identifier'],
            unique: true,
          },
          {
            fields: ['isActive'],
          },
          {
            fields: ['communesToFollow'],
            using: 'gin',
          }
        ],
        schema: 'ban',
        ifNotExists: true,
      })

      // Grant permissions to ban user
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ban TO "${POSTGRES_BAN_USER}";`)
      await queryInterface.sequelize.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ban TO "${POSTGRES_BAN_USER}";`)

    } catch (error) {
      console.error('Erreur lors de la création des tables d\'alertes BAN:', error)
      throw error
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.alert_subscribers CASCADE;')
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.revision_status CASCADE;')
      
      // Drop les types ENUM créés
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS ban."enum_revision_status_status" CASCADE;')
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS ban."enum_alert_subscribers_statusesToFollow" CASCADE;')
      
    } catch (error) {
      console.error('Erreur lors de la suppression des tables d\'alertes BAN:', error)
      throw error
    }
  }
}