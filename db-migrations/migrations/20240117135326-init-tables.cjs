'use strict'

require('dotenv').config()

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Create ban schema if not exists
      await queryInterface.sequelize.query('CREATE SCHEMA IF NOT EXISTS ban;')
      // Grant permissions to ban user on shema ban
      await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA ban TO "${POSTGRES_BAN_USER}";`)

      // Create District Table if not exists
      await queryInterface.createTable('district', {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
        },
        labels: {
          type: Sequelize.ARRAY(Sequelize.JSONB),
          allowNull: false,
        },
        updateDate: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        config: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        meta: {
          type: Sequelize.JSONB,
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

      // Create CommonToponym Table if not exists
      await queryInterface.createTable('common_toponym', {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
        },
        districtID: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'district',
            key: 'id'
          }
        },
        labels: {
          type: Sequelize.ARRAY(Sequelize.JSONB),
          allowNull: false,
        },
        geometry: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        updateDate: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        meta: {
          type: Sequelize.JSONB,
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
        indexes: [
          {
            fields: ['districtID'],
          }
        ],
        schema: 'ban',
        ifNotExists: true,
      })

      // Create Address Table if not exists
      await queryInterface.createTable('address', {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
        },
        mainCommonToponymID: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'common_toponym',
            key: 'id'
          }
        },
        secondaryCommonToponymIDs: {
          type: Sequelize.ARRAY(Sequelize.UUID),
        },
        districtID: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'district',
            key: 'id'
          }
        },
        number: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        suffix: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        labels: {
          type: Sequelize.ARRAY(Sequelize.JSONB),
          allowNull: true,
        },
        certified: {
          type: Sequelize.BOOLEAN,
          allowNull: true,
        },
        positions: {
          type: Sequelize.ARRAY(Sequelize.JSONB),
          allowNull: false,
        },
        updateDate: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        meta: {
          type: Sequelize.JSONB,
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
        indexes: [
          {
            fields: ['mainCommonToponymID'],
          },
          {
            fields: ['secondaryCommonToponymIDs'],
          },
          {
            fields: ['districtID'],
          },
          {
            fields: ['certified'],
          },
        ],
        schema: 'ban',
        ifNotExists: true,
      })

      // Create JobStatus Table if not exists
      await queryInterface.createTable('job_status', {
        id: {
          type: Sequelize.STRING,
          allowNull: false,
          primaryKey: true,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        dataType: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        jobType: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        count: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        message: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        report: {
          type: Sequelize.JSONB,
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
      console.error(error)
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.job_status CASCADE;')
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.address CASCADE;')
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.common_toponym CASCADE;')
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.district CASCADE;')
      await queryInterface.sequelize.query('DROP SCHEMA IF EXISTS ban;')
    } catch (error) {
      console.error(error)
    }
  }
}
