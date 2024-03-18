'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    try {
      // Reaplce createdAt and updatedAt columns to range_validity column on address table
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.address DROP COLUMN "createdAt", DROP COLUMN "updatedAt";
        ALTER TABLE ban.address ADD range_validity tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
        ALTER TABLE ban.address ALTER COLUMN range_validity DROP DEFAULT;
        ALTER TABLE ban.address ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE ban.address ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

      // Reaplce createdAt and updatedAt columns to range_validity column on common_toponym table
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.common_toponym DROP COLUMN "createdAt", DROP COLUMN "updatedAt";
        ALTER TABLE ban.common_toponym ADD range_validity tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
        ALTER TABLE ban.common_toponym ALTER COLUMN range_validity DROP DEFAULT;
        ALTER TABLE ban.common_toponym ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE ban.common_toponym ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)

      // Reaplce createdAt and updatedAt columns to range_validity column on district table
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.district DROP COLUMN "createdAt", DROP COLUMN "updatedAt";
        ALTER TABLE ban.district ADD range_validity tstzrange DEFAULT tstzrange(CURRENT_TIMESTAMP,NULL);
        ALTER TABLE ban.district ALTER COLUMN range_validity DROP DEFAULT;
        ALTER TABLE ban.district ALTER COLUMN range_validity SET NOT NULL;
        ALTER TABLE ban.district ADD CONSTRAINT range_validity CHECK(ISEMPTY(range_validity)IS False);
      `)
    } catch (error) {
      console.error(error)
    }
  },

  async down(queryInterface) {
    try {
      // Reaplce range_validity column to createdAt and updatedAt columns on address table
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.address DROP COLUMN range_validity;
        ALTER TABLE ban.address ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE ban.address ALTER COLUMN "createdAt" DROP DEFAULT;
        ALTER TABLE ban.address ALTER COLUMN "createdAt" SET NOT NULL;
        ALTER TABLE ban.address ADD "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE ban.address ALTER COLUMN "updatedAt" DROP DEFAULT;
        ALTER TABLE ban.address ALTER COLUMN "updatedAt" SET NOT NULL;
      `)

      // Reaplce range_validity column to createdAt and updatedAt columns on common_toponym table
      await queryInterface.sequelize.query(`
        ALTER TABLE ban.common_toponym DROP COLUMN range_validity;
        ALTER TABLE ban.common_toponym ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE ban.common_toponym ALTER COLUMN "createdAt" DROP DEFAULT;
        ALTER TABLE ban.common_toponym ALTER COLUMN "createdAt" SET NOT NULL;
        ALTER TABLE ban.common_toponym ADD "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE ban.common_toponym ALTER COLUMN "updatedAt" DROP DEFAULT;
        ALTER TABLE ban.common_toponym ALTER COLUMN "updatedAt" SET NOT NULL;
      `)

      // Reaplce range_validity column to createdAt and updatedAt columns on district table
      await queryInterface.sequelize.query(`
      ALTER TABLE ban.district DROP COLUMN range_validity;
      ALTER TABLE ban.district ADD "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE ban.district ALTER COLUMN "createdAt" DROP DEFAULT;
      ALTER TABLE ban.district ALTER COLUMN "createdAt" SET NOT NULL;
      ALTER TABLE ban.district ADD "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE ban.district ALTER COLUMN "updatedAt" DROP DEFAULT;
      ALTER TABLE ban.district ALTER COLUMN "updatedAt" SET NOT NULL;
    `)
    } catch (error) {
      console.error(error)
    }
  }
}
