'use strict'

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const addressBboxBuffer = 200;
    const bboxBuffer = 100;
    try {
      // Execute the view creation
      await queryInterface.sequelize.query(`
        CREATE VIEW ban."common_toponym_view" AS
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
        ORDER BY CT.id ASC     `
      )
      // Grant permissions to ban user
      await queryInterface.sequelize.query(`GRANT SELECT ON ban."common_toponym_view" TO "${POSTGRES_BAN_USER}";`)
    } catch (error) {
      console.log(error);
    }
  },

  async down(queryInterface) {
    try {
      // Drop the view if it exists
      await queryInterface.sequelize.query('DROP VIEW IF EXISTS ban."common_toponym_view" ;');
    } catch (error) {
      console.log(error);
    }
  }
}