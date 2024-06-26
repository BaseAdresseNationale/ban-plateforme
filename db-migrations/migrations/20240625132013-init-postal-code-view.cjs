'use strict'

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    try {
      // Create the address_view
      await queryInterface.sequelize.query(`
        CREATE VIEW ban."address_view_cp" AS
        WITH postal_codes_array AS (
          SELECT
          a.id,
          a."mainCommonToponymID",
          a."secondaryCommonToponymIDs",
          a.labels,
          a.suffix,
          a.positions,
          a.certified,
          a.bbox,
              array_length(d."postalCodes", 1) AS array_length,
              d."postalCodes" AS ps,
              b.meta->'insee'->>'cog' AS insee_com,
          d."libelleAcheminement"
          FROM 
              ban.address_view AS a
          LEFT JOIN 
              ban.district AS b
              ON a."districtID" = b.id
          LEFT JOIN 
              external.datanova AS d
              ON b.meta->'insee'->>'cog' = d."inseeCom"
      )
      SELECT
          pca.id,
          pca."mainCommonToponymID",
          pca."secondaryCommonToponymIDs",
          pca.insee_com,
          CASE
              WHEN pca.array_length = 1 THEN pca.ps[1]
              WHEN pca.array_length > 1 AND EXISTS (
           		 SELECT 1
            	FROM external.postal_area AS c
            	WHERE ST_Intersects(ST_Transform(pca.bbox, 2154), ST_Transform(c.geometry, 2154)))
			  THEN (
                  SELECT c."postalCode"
                  FROM external.postal_area AS c
                  WHERE pca.insee_com = c."inseeCom"
                  ORDER BY ST_Area(ST_Intersection(ST_Transform(pca.bbox, 2154), ST_Transform(c.geometry, 2154))) desc
                  LIMIT 1
              )
              ELSE NULL
          END AS postal_code,
          CASE
              WHEN pca.array_length = 1 THEN 'DATANOVA'
              WHEN pca.array_length > 1 AND 
			  EXISTS (
           		 SELECT 1
            	FROM external.postal_area AS c
            	WHERE ST_Intersects(ST_Transform(pca.bbox, 2154), ST_Transform(c.geometry, 2154)))
			  THEN 'CONTOURS_CP'
              ELSE 'DGFIP' 
          END AS source_cp,
          pca."libelleAcheminement",
          pca.labels,
          pca.suffix,
          pca.positions,
          pca.certified,
          pca.bbox
      FROM 
          postal_codes_array AS pca
          ORDER BY pca.id ASC
      `)
      await queryInterface.sequelize.query(`GRANT SELECT ON ban."address_view_cp" TO "${POSTGRES_BAN_USER}";`)

      await queryInterface.sequelize.query(`
      CREATE VIEW ban."common_toponym_view_cp" AS
      WITH postal_codes_array AS (
        SELECT
            ct.id,
            ct."districtID",
            ct.labels,
            ct.geometry,
            ct.meta,
            ct.centroid,
            ct."addressBbox",
            ct.bbox,
            b.meta->'insee'->>'cog' AS insee_com,
            array_length(d."postalCodes", 1) AS array_length,
            d."postalCodes" AS ps,
            d."libelleAcheminement",
            ct."addressCount",
            CASE 
                WHEN ct."addressCount" = 0 THEN ct.bbox
                ELSE ct."addressBbox"
            END AS used_bbox
        FROM 
            ban.common_toponym_view AS ct
        LEFT JOIN 
            ban.district AS b
            ON ct."districtID" = b.id
        LEFT JOIN 
            external.datanova AS d
        ON b.meta->'insee'->>'cog' = d."inseeCom"
    )
    SELECT
        pca.id,
        pca."districtID",
        pca.insee_com,
        CASE
            WHEN pca.array_length = 1 THEN pca.ps[1]
            WHEN pca.array_length > 1 AND EXISTS (
                SELECT 1
                FROM external.postal_area AS c
                WHERE ST_Intersects(ST_Transform(pca.used_bbox, 2154), ST_Transform(c.geometry, 2154))
            ) THEN (
                SELECT c."postalCode"
                FROM external.postal_area AS c
          WHERE pca.insee_com = c."inseeCom" 
                ORDER BY ST_Area(ST_Intersection(ST_Transform(pca.used_bbox, 2154), ST_Transform(c.geometry, 2154))) DESC
                LIMIT 1
            )
            ELSE NULL
        END AS postal_code,
        CASE
            WHEN pca.array_length = 1 THEN 'DATANOVA'
            WHEN pca.array_length > 1 AND EXISTS (
                SELECT 1
                FROM external.postal_area AS c
                WHERE ST_Intersects(ST_Transform(pca.used_bbox, 2154), ST_Transform(c.geometry, 2154))
            ) THEN 'CONTOURS_CP'
            ELSE 'DGFIP'
        END AS source_cp,
        pca."libelleAcheminement",
        pca.labels,
        pca.geometry,
        pca.meta,
        pca.centroid,
        pca."addressBbox",
        pca.bbox
    FROM 
        postal_codes_array AS pca
        ORDER BY pca.id ASC
      `)
      await queryInterface.sequelize.query(`GRANT SELECT ON ban."common_toponym_view_cp" TO "${POSTGRES_BAN_USER}";`)
    } catch (error) {
      console.log(error)
    }
  },

  async down(queryInterface) {
    try {
      // Drop the address_view if it exists
      await queryInterface.sequelize.query('DROP VIEW IF EXISTS ban."address_view_cp";')
      await queryInterface.sequelize.query('DROP VIEW IF EXISTS ban."common_toponym_view_cp";')
    } catch (error) {
      console.log(error)
    }
  }
}
