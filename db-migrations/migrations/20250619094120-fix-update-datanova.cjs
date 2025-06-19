'use strict'

const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')

const {MIGRATION_DATA_FOLDER_PATH} = process.env
const DATANOVA_FILE_NAME = '20240404142921-datanova.csv'

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      const {POSTGRES_BAN_USER} = process.env
      await queryInterface.sequelize.query('CREATE SCHEMA IF NOT EXISTS external', {transaction})
      await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA external TO "${POSTGRES_BAN_USER}"`, {transaction})
      await queryInterface.sequelize.query(`GRANT ALL PRIVILEGES ON SCHEMA external TO "${POSTGRES_BAN_USER}"`, {transaction})
      await queryInterface.dropTable({schema: 'external', tableName: 'datanova'}, {transaction})

      await queryInterface.createTable({
        schema: 'external',
        tableName: 'datanova'
      }, {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        inseeCom: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        postalCodes: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          allowNull: false,
        },
        libelleAcheminementWithPostalCodes: {
          type: Sequelize.JSONB,
          allowNull: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn('now')
        }
      }, {transaction})

      const DATA_FILE_PATH = path.resolve(MIGRATION_DATA_FOLDER_PATH, `${DATANOVA_FILE_NAME}`)
      if (fs.existsSync(DATA_FILE_PATH)) {
        const csvFilePath = path.resolve(DATA_FILE_PATH)

        const csvFileContent = fs.readFileSync(csvFilePath, 'utf8')

        const dataRaw = Papa.parse(csvFileContent, {
          header: true,
          transformHeader(name) {
            switch (name.toLowerCase()) {
              case 'code_commune_insee':
                return 'codeInsee'
              case 'nom_de_la_commune':
                return 'nomCommune'
              case 'code_postal':
                return 'codePostal'
              case 'libelle_d_acheminement':
                return 'libelleAcheminement'
              case 'ligne_5':
                return 'ligne5'
              case '_geopoint':
                return 'geopoint'
              default:
                return name
            }
          },
          skipEmptyLines: true,
        })

        const inseeDataMap = dataRaw.data.reduce((acc, {codeInsee, codePostal, libelleAcheminement}) => {
          if (!acc[codeInsee]) {
            acc[codeInsee] = {
              inseeCom: codeInsee,
              postalCodes: new Set(),
              libelleAcheminementWithPostalCodes: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          }

          acc[codeInsee].postalCodes.add(codePostal)
          if (!acc[codeInsee].libelleAcheminementWithPostalCodes[codePostal]) {
            acc[codeInsee].libelleAcheminementWithPostalCodes[codePostal] = libelleAcheminement
          }

          return acc
        }, {})

        const formattedData = Object.values(inseeDataMap).map(entry => ({
          ...entry,
          postalCodes: [...entry.postalCodes],
          libelleAcheminementWithPostalCodes: JSON.stringify(entry.libelleAcheminementWithPostalCodes)
        }))

        await queryInterface.bulkInsert({schema: 'external', tableName: 'datanova'}, formattedData, {transaction})

        // Convert the column to JSONB after insertion
        await queryInterface.sequelize.query(`
                ALTER TABLE external.datanova 
                ALTER COLUMN "libelleAcheminementWithPostalCodes" 
                TYPE JSONB USING "libelleAcheminementWithPostalCodes"::JSONB
              `, {transaction})
      }

      await queryInterface.sequelize.query(
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA external TO "${POSTGRES_BAN_USER}";`,
        {transaction}
      )

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      console.error('Error during migration:', error)
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.dropTable({schema: 'external', tableName: 'datanova'}, {transaction})
      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      console.error('Error during migration rollback:', error)
    }
  }
}
