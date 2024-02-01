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
      await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA external TO ${POSTGRES_BAN_USER};`)

      // Create contours_postaux Table if not exists
      await queryInterface.createTable('contours_postaux', {
        codePostal: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        cog: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        geometry: {
          type: Sequelize.JSONB,
          allowNull: false,
        },
      }, {
        schema: 'external',
        ifNotExists: true,
      })

      // Grant permissions to ban user
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA external TO ${POSTGRES_BAN_USER};`)

      // Create Address with meta View
      await queryInterface.sequelize.query(`
        CREATE OR REPLACE VIEW ban.address_with_meta AS
          WITH banMeta AS (
            SELECT
              a.id,
              ST_AsGeoJSON(ST_Transform(ST_Buffer(ST_Transform(ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON((a.positions[1])->'geometry'), 4326)), 2154), 50, 'join=mitre endcap=square'), 4326)) AS bbox
            FROM ban.address AS a
          ),
          inseeMeta AS (
            SELECT
              a.id,
              d.meta->'insee'->>'cog' AS cog
            FROM ban.address AS a
            LEFT JOIN ban.district AS d
            ON a."districtID" = d.id
          ),
          laPosteMeta AS (
            SELECT
              a.id,
              d.meta->'laPoste'->>'libelleAcheminement' AS libelleAcheminement,
              CASE JSONB_ARRAY_LENGTH(d.meta->'laPoste'->'codePostal')
                WHEN '1' THEN (d.meta->'laPoste'->'codePostal')[0]::text
                  ELSE
                    COALESCE(
                      cp."codePostal",
                      (
                        SELECT cp2."codePostal"
                        FROM external.contours_postaux AS cp2
                        WHERE (d.meta->'insee')->> 'cog' LIKE cp2.cog
                        ORDER BY ST_Distance(
                          ST_GeomFromGeoJSON((a.positions[1])->'geometry'),
                          cp2.geometry)
                        LIMIT 1
                      )
                    )
              END
              AS codePostal,
              CASE JSONB_ARRAY_LENGTH(d.meta->'laPoste'->'codePostal')
                WHEN '1' THEN 'La Poste - dataNOVA'
              END
              AS source
            FROM ban.address AS a
            LEFT JOIN ban.district AS d
            ON a."districtID" = d.id
            LEFT JOIN external.contours_postaux AS cp
            ON (d.meta->'insee')->> 'cog' LIKE cp.cog AND ST_Within(ST_GeomFromGeoJSON((a.positions[1])->'geometry'), cp.geometry)
          )
          SELECT
            a.id,
            a."districtID",
            a."mainCommonToponymID",
            a."secondaryCommonToponymIDs",
            a.labels,
            a.number,
            a.suffix,
            a.positions,
            a.certified,
            COALESCE(
              a.meta,
              jsonb ('{}')
            ) ||
            COALESCE(
              jsonb('{"ban": {"bbox": ' || banMeta.bbox::text || '}}'),
              jsonb('{}')
            ) ||
            COALESCE(
              jsonb('{"insee": {"cog": "' || inseeMeta.cog || '"}}'),
              jsonb('{}')
            ) ||
            CASE 
              WHEN laPosteMeta.codePostal IS NOT NULL AND laPosteMeta.source IS NOT NULL
              THEN COALESCE(
                jsonb('{"laPoste": {"codePostal": "' || laPosteMeta.codePostal || '", "source": "' || laPosteMeta.source || '", "libelleAcheminement": "' || laPosteMeta.libelleAcheminement || '"}}'),
                jsonb('{"laPoste": {"codePostal": "' || laPosteMeta.codePostal || '", "source": "' || laPosteMeta.source || '"}}')
              )
              WHEN laPosteMeta.codePostal IS NOT NULL
              THEN COALESCE(
                jsonb('{"laPoste": {"codePostal": "' || laPosteMeta.codePostal || '", "source": "La Poste - contours postaux", "libelleAcheminement": "' || laPosteMeta.libelleAcheminement || '"}}'),
                jsonb('{"laPoste": {"codePostal": "' || laPosteMeta.codePostal || '", "source": "La Poste - contours postaux"}}')
              )
              ELSE COALESCE(
                jsonb('{"laPoste": {"libelleAcheminement": "' || laPosteMeta.libelleAcheminement || '"}}'),
                jsonb('{}')
              )
            END
            AS meta,
            a."updateDate"
          FROM ban.address AS a
          LEFT JOIN banMeta
          ON a.id = banMeta.id
          LEFT JOIN inseeMeta
          ON a.id = inseeMeta.id
          LEFT JOIN laPosteMeta
          ON a.id = laPosteMeta.id
      `)

      // Create Common Toponym with meta View
      await queryInterface.sequelize.query(`
        CREATE OR REPLACE VIEW ban.common_toponym_with_meta AS
          WITH banMeta AS (
            SELECT
              ct.id,
              ST_AsGeoJSON(ST_Centroid(ST_Collect(ST_GeomFromGeoJSON(a.positions[1] ->> 'geometry')))) AS centroid,
              ST_AsGeoJSON(ST_Transform(ST_Buffer(ST_Transform(ST_Envelope(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON(a.positions[1] ->> 'geometry'), 4326))), 2154), 200, 'join=mitre endcap=square'), 4326)) AS addressBbox,
              ST_AsGeoJSON(ST_Transform(ST_Buffer(ST_Transform(ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON(ct.geometry), 4326)), 2154), 100, 'join=mitre endcap=square'), 4326)) AS bbox
            FROM ban.common_toponym AS ct
            LEFT JOIN ban.address_with_meta AS a
            ON ct.id = a."mainCommonToponymID" OR ct.id = ANY (a."secondaryCommonToponymIDs")
            GROUP BY ct.id
          ),
          inseeMeta AS (
            SELECT
              ct.id,
              d.meta -> 'insee' ->> 'cog' AS cog
            FROM ban.common_toponym AS ct
            LEFT JOIN ban.district AS d
            ON ct."districtID" = d.id
            ),
            laPosteMeta AS (
              SELECT
                ct.id,
                d.meta -> 'laPoste' ->> 'libelleAcheminement' AS libelleAcheminement,
                array_agg(DISTINCT '"' || (a.meta -> 'laPoste' ->> 'codePostal') || '"') AS codePostal,
                a.meta -> 'laPoste' ->> 'source' AS source
              FROM ban.common_toponym AS ct
              LEFT JOIN ban.district AS d
              ON ct."districtID" = d.id
              LEFT JOIN ban.address_with_meta AS a
              ON (ct.id = a."mainCommonToponymID" OR ct.id = ANY (a."secondaryCommonToponymIDs")) AND (a.meta -> 'laPoste' ->> 'codePostal') IS NOT NULL
              GROUP BY 
                ct.id,
                d.meta,
                (a.meta -> 'laPoste' ->> 'source')
            )
          SELECT
            ct.id,
            ct."districtID",
            ct.labels,
            ct.geometry,
            COALESCE(
              ct.meta,
              jsonb('{}')
            ) ||
            CASE
              WHEN banMeta.centroid IS NOT NULL
              THEN jsonb(
                '{"ban": {"centroid": ' || banMeta.centroid || ', "addressBbox": ' || banMeta.addressBbox ||
                COALESCE(
                  (', "bbox": ' || banMeta.bbox) || '}}',
                  '}}'
                  )
                )
              ELSE COALESCE(
                jsonb('{"ban": {"bbox": ' || banMeta.bbox || '}}'),
                jsonb('{}')
              )
            END ||
            COALESCE(
              jsonb('{"insee": {"cog": "' || inseeMeta.cog || '"}}'),
              jsonb('{}')
            ) ||
            CASE 
              WHEN laPosteMeta.codePostal[1] IS NOT NULL
              THEN jsonb(
                '{"laPoste": {"codePostal": ' ||
                replace(replace(laPosteMeta.codePostal::text, '{', '['), '}', ']') ||
                ', "source": "' || laPosteMeta.source ||
                COALESCE(
                  '", "libelleAcheminement": "' || laPosteMeta.libelleAcheminement || '"}}',
                  '"}}'
                )
              )
              ELSE COALESCE(
                jsonb('{"laPoste": {"libelleAcheminement": "' || laPosteMeta.libelleAcheminement || '"}}'),
                jsonb('{}')
              )
            END
            AS meta,
            ct."updateDate"
          FROM ban.common_toponym AS ct
          LEFT JOIN ban.district AS d
          ON d.id = ct."districtID"
          LEFT JOIN banMeta ON ct.id = banMeta.id
          LEFT JOIN inseeMeta ON ct.id = inseeMeta.id
          LEFT JOIN laPosteMeta ON ct.id = laPosteMeta.id
      `)
      // Grant permissions to ban user
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL VIEWS IN SCHEMA ban TO ${POSTGRES_BAN_USER};`)
    } catch (error) {
      console.error(error)
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.sequelize.query('DROP VIEW IF EXISTS ban.common_toponym_with_meta CASCADE;')
      await queryInterface.sequelize.query('DROP VIEW IF EXISTS ban.address_with_meta CASCADE;')
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS external.contours_postaux CASCADE;')
      await queryInterface.sequelize.query('DROP SCHEMA IF EXISTS external;')
    } catch (error) {
      console.error(error)
    }
  }
}
