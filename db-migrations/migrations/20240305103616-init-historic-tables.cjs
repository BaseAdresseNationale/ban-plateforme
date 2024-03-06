'use strict'

require('dotenv').config()

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    try {
      // Add btree_gist extension used for creating exclusion constraints using GiST indexes on range types
      await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist;')

      // Create address_h historic table
      // the adresse_h_id_range_validity_excl constraint ensures that no two rows have the same id value and overlapping range_validity ranges.
      await queryInterface.sequelize.query(`
        CREATE TABLE ban.address_h (LIKE ban.address);
        ALTER TABLE ban.address_h ADD CONSTRAINT adresse_h_id_fkey FOREIGN KEY (id)
          REFERENCES ban.address (id) MATCH SIMPLE
          ON UPDATE NO ACTION
          ON DELETE NO ACTION;
        ALTER TABLE ban.address_h ADD CONSTRAINT adresse_h_id_range_validity_excl EXCLUDE USING gist (
          id WITH =,
          range_validity WITH &&);
        CREATE INDEX ON  ban.address_h (id);
        CREATE INDEX ON ban.address_h USING GIST (range_validity);
        ALTER TABLE  ban.address_h ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE  ban.address_h ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

      // Create common_toponym_h historic table
      // the common_toponym_h_id_range_validity_excl constraint ensures that no two rows have the same id value and overlapping range_validity ranges.
      await queryInterface.sequelize.query(`
        CREATE TABLE ban.common_toponym_h (LIKE ban.common_toponym);
        ALTER TABLE ban.common_toponym_h ADD CONSTRAINT common_toponym_h_id_fkey FOREIGN KEY (id)
          REFERENCES ban.common_toponym (id) MATCH SIMPLE
          ON UPDATE NO ACTION
          ON DELETE NO ACTION;
        ALTER TABLE ban.common_toponym_h ADD CONSTRAINT common_toponym_h_id_range_validity_excl EXCLUDE USING gist (
          id WITH =,
          range_validity WITH &&);
        CREATE INDEX ON  ban.common_toponym_h (id);
        CREATE INDEX ON ban.common_toponym_h USING GIST (range_validity);
        ALTER TABLE  ban.common_toponym_h ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE  ban.common_toponym_h ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

      // Create district_h historic table
      // the district_h_id_range_validity_excl constraint ensures that no two rows have the same id value and overlapping range_validity ranges.
      await queryInterface.sequelize.query(`
        CREATE TABLE ban.district_h (LIKE ban.district);
        ALTER TABLE ban.district_h ADD CONSTRAINT district_h_id_fkey FOREIGN KEY (id)
          REFERENCES ban.district (id) MATCH SIMPLE
          ON UPDATE NO ACTION
          ON DELETE NO ACTION;
        ALTER TABLE ban.district_h ADD CONSTRAINT district_h_id_range_validity_excl EXCLUDE USING gist (
          id WITH =,
          range_validity WITH &&);
        CREATE INDEX ON  ban.district_h (id);
        CREATE INDEX ON ban.district_h USING GIST (range_validity);
        ALTER TABLE  ban.district_h ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE  ban.district_h ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)
      // Grant permissions to ban user
      await queryInterface.sequelize.query(`GRANT SELECT, INSERT ON TABLE ban.address_h, ban.common_toponym_h, ban.district_h TO "${POSTGRES_BAN_USER}";`)
    } catch (error) {
      console.log(error)
    }
  },

  async down(queryInterface) {
    try {
      // Drop historic tables
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.address_h;')
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.common_toponym_h;')
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS ban.district_h;')

      // Drop btree_gist extension
      await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS btree_gist;')
    } catch (error) {
      console.log(error)
    }
  }
}
