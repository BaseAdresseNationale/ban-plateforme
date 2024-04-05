'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    try {
    // Add range_validity and isActive columns on address table
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.address ADD range_validity tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
        ALTER TABLE ban.address ADD "isActive" boolean DEFAULT true;
        ALTER TABLE ban.address ALTER COLUMN "isActive" SET NOT NULL;
      `)

      // Add range_validity and isActive columns on common_toponym table
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.common_toponym ADD range_validity tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
        ALTER TABLE ban.common_toponym ADD "isActive" boolean DEFAULT true;
        ALTER TABLE ban.common_toponym ALTER COLUMN "isActive" SET NOT NULL;
      `)

      // Add range_validity and isActive columns on district table
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.district ADD range_validity tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
        ALTER TABLE ban.district ADD "isActive" boolean DEFAULT true;
        ALTER TABLE ban.district ALTER COLUMN "isActive" SET NOT NULL;
      `)
    } catch (error) {
      console.error(error)
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.address DROP COLUMN range_validity;
        ALTER TABLE ban.address DROP COLUMN "isActive";
      `)

      await queryInterface.sequelize.query(`
        ALTER TABLE ban.common_toponym DROP COLUMN range_validity;
        ALTER TABLE ban.common_toponym DROP COLUMN "isActive";
      `)

      await queryInterface.sequelize.query(`
        ALTER TABLE ban.district DROP COLUMN range_validity;
        ALTER TABLE ban.district DROP COLUMN "isActive";
      `)
    } catch (error) {
      console.error(error)
    }
  }
}
