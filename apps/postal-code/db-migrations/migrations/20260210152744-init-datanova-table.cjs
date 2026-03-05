'use strict'

const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')
const {env} = require('@ban/config')

const DATANOVA_FILE_NAME = '20250619094120-datanova.csv'

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.sequelize.query('CREATE SCHEMA IF NOT EXISTS postal', {transaction})
      await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA postal TO "${env.PG.user}"`, {transaction})

      await queryInterface.createTable({
        schema: 'postal',
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

      const DATA_FILE_PATH = path.resolve(env.PG.dataPath, `${DATANOVA_FILE_NAME}`)
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

        await queryInterface.bulkInsert({schema: 'postal', tableName: 'datanova'}, formattedData, {transaction})

        // Convert the column to JSONB after insertion
        await queryInterface.sequelize.query(`
          ALTER TABLE postal.datanova 
          ALTER COLUMN "libelleAcheminementWithPostalCodes" 
          TYPE JSONB USING "libelleAcheminementWithPostalCodes"::JSONB
        `, {transaction})
      }
      await queryInterface.sequelize.query(`GRANT SELECT ON ALL TABLES IN SCHEMA postal TO "${env.PG.user}"`, {transaction})

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      console.error('Error during migration:', error)
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.dropTable({schema: 'postal', tableName: 'datanova'}, {transaction})

      await queryInterface.sequelize.query('DROP SCHEMA IF EXISTS postal CASCADE', {transaction})

      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      console.error('Error during migration rollback:', error)
    }
  }
}
