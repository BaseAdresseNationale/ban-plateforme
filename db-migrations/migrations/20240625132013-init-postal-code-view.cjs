'use strict'

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const bboxBufferAdressView = 50
    const addressBboxBuffer = 200
    const bboxBuffer = 100

    try {
      // Create the address_view

      await queryInterface.sequelize.query(`
      CREATE VIEW ban."address_view_cp" AS
      WITH  address_view AS (
        SELECT
          A.*,
          ST_Transform(ST_Buffer(ST_Transform(ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON((A.positions[1])->'geometry'), 4326)), 2154), ${bboxBufferAdressView}, 'join=mitre endcap=square'), 4326) AS bbox
        FROM
          ban.address AS A
        WHERE A."isActive" = true
        ORDER BY A.id ASC ),      
	   	postal_codes_array AS (
        SELECT
			a.*,
            array_length(d."postalCodes", 1) AS array_length,
            d."postalCodes" AS postalCodes,
            b.meta->'insee'->>'cog' AS insee_com,
        d."libelleAcheminementWithPostalCodes"
        FROM 
            address_view AS a
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
		pca."districtID",
		pca."number",
		pca."suffix",
		pca."labels",
		pca."certified",
		pca."positions",
		pca."updateDate",
		pca."meta",
		pca."range_validity",
		pca."isActive",
		pca."bbox",
		pca.insee_com,
        CASE
            WHEN pca.array_length = 1 THEN pca.postalCodes[1]
            WHEN pca.array_length > 1
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
        WHEN pca.array_length = 1 THEN pca."libelleAcheminementWithPostalCodes"->>pca.postalCodes[1]
        WHEN pca.array_length > 1
        THEN (
            SELECT pca."libelleAcheminementWithPostalCodes"->>c."postalCode"
            FROM external.postal_area AS c
            WHERE pca.insee_com = c."inseeCom"
            ORDER BY ST_Area(ST_Intersection(ST_Transform(pca.bbox, 2154), ST_Transform(c.geometry, 2154))) DESC
            LIMIT 1
        )
        ELSE NULL
    END AS "libelleAcheminement",
		pca.postalCodes,
		pca."libelleAcheminementWithPostalCodes",
    CASE
      WHEN pca.array_length = 1 THEN 'DATANOVA'
      WHEN pca.array_length > 1 THEN 
          CASE
              WHEN EXISTS (
                  SELECT 1
                  FROM external.postal_area AS c
                  WHERE pca.insee_com = c."inseeCom"
                  AND ST_Intersects(ST_Transform(pca.bbox, 2154), ST_Transform(c.geometry, 2154))
              ) THEN 'CONTOURS_CP'
              ELSE 'DGFIP'
          END
      ELSE 'DGFIP'
    END AS source_cp
    FROM 
        postal_codes_array AS pca
        ORDER BY pca.id ASC
      `)
      await queryInterface.sequelize.query(`GRANT SELECT ON ban."address_view_cp" TO "${POSTGRES_BAN_USER}";`)

      await queryInterface.sequelize.query(`
      CREATE VIEW ban."common_toponym_view_cp" AS
      WITH common_toponym_view AS(
        SELECT
          CT.id, CT."districtID", CT.labels, CT.geometry, CT."updateDate", CT.meta, CT.range_validity, CT."isActive",
          ST_Centroid(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON((A.positions[1])->'geometry'), 4326))) AS centroid,
          ST_Transform(ST_Buffer(ST_Transform(ST_Envelope(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON((A.positions[1])->'geometry'), 4326))), 2154), ${addressBboxBuffer}, 'join=mitre endcap=square'), 4326) AS "addressBbox",
          ST_Transform(ST_Buffer(ST_Transform(ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON(CT.geometry), 4326)), 2154), ${bboxBuffer}, 'join=mitre endcap=square'), 4326) AS "bbox",
          COUNT(A.id) AS "addressCount",
          COUNT(DISTINCT CASE WHEN A.certified = true THEN A.id ELSE NULL END) AS "certifiedAddressCount"
        FROM
          ban.common_toponym AS CT
        LEFT JOIN
          ban.address AS A
        ON
          (CT.id = A."mainCommonToponymID"
          OR CT.id = ANY(A."secondaryCommonToponymIDs")) AND A."isActive" = true
        WHERE CT."isActive" = true
        GROUP BY CT.id
        ORDER BY CT.id ASC  ),   
	 
	  postal_codes_array AS (
        SELECT
		    ct.*,
            b.meta->'insee'->>'cog' AS insee_com,
            array_length(d."postalCodes", 1) AS array_length,
            d."postalCodes" AS postalCodes,
        	d."libelleAcheminementWithPostalCodes",
            CASE 
                WHEN ct."addressCount" = 0 THEN ct.bbox
                ELSE ct."addressBbox"
            END AS used_bbox
        FROM 
            common_toponym_view AS ct
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
		pca.labels, 
		pca.geometry, 
		pca."updateDate", 
		pca.meta, 
		pca.range_validity, 
		pca."isActive", 
		pca.centroid, 
		pca."addressBbox", 
		pca.bbox, 
		pca."addressCount", 
		pca."certifiedAddressCount",
        pca.insee_com,
        CASE
            WHEN pca.array_length = 1 THEN pca.postalCodes[1]
            WHEN pca.array_length > 1 
            THEN (
                SELECT c."postalCode"
                FROM external.postal_area AS c
          WHERE pca.insee_com = c."inseeCom" 
                ORDER BY ST_Area(ST_Intersection(ST_Transform(pca.used_bbox, 2154), ST_Transform(c.geometry, 2154))) DESC
                LIMIT 1
            )
            ELSE NULL
        END AS postal_code,
    CASE
        WHEN pca.array_length = 1 THEN pca."libelleAcheminementWithPostalCodes"->>pca.postalCodes[1]
        WHEN pca.array_length > 1
        THEN (
            SELECT pca."libelleAcheminementWithPostalCodes"->>c."postalCode"
            FROM external.postal_area AS c
            WHERE pca.insee_com = c."inseeCom"
            ORDER BY ST_Area(ST_Intersection(ST_Transform(pca.bbox, 2154), ST_Transform(c.geometry, 2154))) DESC
            LIMIT 1
        )
        ELSE NULL
    END AS "libelleAcheminement",
	pca.postalCodes,
	pca."libelleAcheminementWithPostalCodes",
      CASE
      WHEN pca.array_length = 1 THEN 'DATANOVA'
      WHEN pca.array_length > 1 THEN 
          CASE
              WHEN EXISTS (
                  SELECT 1
                  FROM external.postal_area AS c
                  WHERE pca.insee_com = c."inseeCom"
                  AND ST_Intersects(ST_Transform(pca.used_bbox, 2154), ST_Transform(c.geometry, 2154))
              ) THEN 'CONTOURS_CP'
              ELSE 'DGFIP'
          END
      ELSE 'DGFIP'
    END AS source_cp,
		pca.used_bbox
    FROM 
        postal_codes_array AS pca
        ORDER BY pca.id ASC
      `)
      await queryInterface.sequelize.query(`GRANT SELECT ON ban."common_toponym_view_cp" TO "${POSTGRES_BAN_USER}";`)
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ban TO "${POSTGRES_BAN_USER}";`)
      await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA ban TO "${POSTGRES_BAN_USER}";`)
      await queryInterface.sequelize.query(`GRANT ALL PRIVILEGES ON SCHEMA ban TO "${POSTGRES_BAN_USER}";`)
      await queryInterface.sequelize.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ban TO "${POSTGRES_BAN_USER}";`)
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${POSTGRES_BAN_USER}";`)
      await queryInterface.sequelize.query(`GRANT USAGE ON SCHEMA public TO "${POSTGRES_BAN_USER}";`)
      await queryInterface.sequelize.query(`GRANT ALL PRIVILEGES ON SCHEMA public TO "${POSTGRES_BAN_USER}";`)
      await queryInterface.sequelize.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${POSTGRES_BAN_USER}";`)

      // Drop unused view

      await queryInterface.sequelize.query('DROP VIEW IF EXISTS ban."address_view";')
      await queryInterface.sequelize.query('DROP VIEW IF EXISTS ban."common_toponym_view";')
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
