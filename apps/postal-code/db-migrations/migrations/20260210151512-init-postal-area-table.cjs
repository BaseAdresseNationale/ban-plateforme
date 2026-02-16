'use strict'

const fs = require('fs')
const {Transform} = require('stream')
const JSONStream = require('JSONStream')
const {env} = require('@ban/config')

const CP_FILE_NAME = '20250513174433-contours-postaux.geojson'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

      await queryInterface.sequelize.query('CREATE SCHEMA IF NOT EXISTS postal;')
      await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA postal TO "${env.PG.user}";`)

      await queryInterface.createTable('postal_area', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        postalCode: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        inseeCom: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        geometry: {
          type: Sequelize.GEOMETRY,
          allowNull: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      }, {
        schema: 'postal',
        ifNotExists: true,
      })

      await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW."updatedAt" = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `)

      await queryInterface.sequelize.query(`
        CREATE TRIGGER update_postal_area_updated_at
        BEFORE UPDATE ON postal.postal_area
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      `)

      const {sequelize} = queryInterface

      const insertFeature = async feature => {
        const {cp: postalCode, insee_com: inseeCom} = feature.properties
        const geom = JSON.stringify(feature.geometry)
        const query = `
          INSERT INTO postal.postal_area ("postalCode", "inseeCom", geometry, "createdAt", "updatedAt")
          VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 2154), NOW(), NOW())
        `
        await sequelize.query(query, {
          bind: [postalCode, inseeCom, geom],
        })
      }

      const DATA_FILE_PATH = `${env.PG.dataPath}/${CP_FILE_NAME}`
      if (fs.existsSync(DATA_FILE_PATH)) {
        const stream = fs.createReadStream(DATA_FILE_PATH)
          .pipe(JSONStream.parse('features.*'))
          .pipe(new Transform({
            objectMode: true,
            async transform(feature, encoding, callback) {
              try {
                await insertFeature(feature)
                callback()
              } catch (error) {
                callback(error)
              }
            },
          }))
        await new Promise((resolve, reject) => {
          stream.on('finish', resolve)
          stream.on('error', reject)
        })
      }

      await queryInterface.sequelize.query(`GRANT SELECT ON ALL TABLES IN SCHEMA postal TO "${env.PG.user}";`)

  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable({tableName: 'postal_area', schema: 'postal'})
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;')
    await queryInterface.sequelize.query('DROP SCHEMA IF EXISTS postal CASCADE;')
  },
}
