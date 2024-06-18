'use strict'

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const bboxBuffer = 50;
    try {
      // Create the address_view
      await queryInterface.sequelize.query(`
        CREATE VIEW ban."address_view" AS
        SELECT
          A.*,
          ST_Transform(ST_Buffer(ST_Transform(ST_Envelope(ST_SetSRID(ST_GeomFromGeoJSON((A.positions[1])->'geometry'), 4326)), 2154), ${bboxBuffer}, 'join=mitre endcap=square'), 4326) AS bbox
        FROM
          ban.address AS A
        WHERE A."isActive" = true
        ORDER BY A.id ASC
      `)
      await queryInterface.sequelize.query(`GRANT SELECT ON ban."address_view" TO "${POSTGRES_BAN_USER}";`);
    } catch (error) {
      console.log(error);
    }
  },

  async down(queryInterface) {
    try {
      // Drop the address_view if it exists
      await queryInterface.sequelize.query('DROP VIEW IF EXISTS ban."address_view";');
    } catch (error) {
      console.log(error);
    }
  }
}