/* eslint-disable , semi, eol-last */
'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    try {
      // Tables principales
      await queryInterface.sequelize.query(
        'ALTER TABLE ban.common_toponym ALTER COLUMN "updateDate" DROP NOT NULL;'
      )
      await queryInterface.sequelize.query(
        'ALTER TABLE ban.address ALTER COLUMN "updateDate" DROP NOT NULL;'
      )
      // Tables d'historique (si elles existent)
      await queryInterface.sequelize.query(
        'ALTER TABLE ban.common_toponym_h ALTER COLUMN "updateDate" DROP NOT NULL;'
      )
      await queryInterface.sequelize.query(
        'ALTER TABLE ban.address_h ALTER COLUMN "updateDate" DROP NOT NULL;'
      )
    } catch (error) {
      console.error(error)
      throw error
    }
  },
  async down(queryInterface) {
    try {
      // 1. Remplir les NULL dans les tables principales ET d'historique
      await queryInterface.sequelize.query(
        'UPDATE ban.common_toponym SET "updateDate" = NOW() WHERE "updateDate" IS NULL;'
      )
      await queryInterface.sequelize.query(
        'UPDATE ban.address SET "updateDate" = NOW() WHERE "updateDate" IS NULL;'
      )
      await queryInterface.sequelize.query(
        'UPDATE ban.common_toponym_h SET "updateDate" = NOW() WHERE "updateDate" IS NULL;'
      )
      await queryInterface.sequelize.query(
        'UPDATE ban.address_h SET "updateDate" = NOW() WHERE "updateDate" IS NULL;'
      )
      // 2. Remettre NOT NULL
      await queryInterface.sequelize.query(
        'ALTER TABLE ban.common_toponym ALTER COLUMN "updateDate" SET NOT NULL;'
      )
      await queryInterface.sequelize.query(
        'ALTER TABLE ban.address ALTER COLUMN "updateDate" SET NOT NULL;'
      )
      await queryInterface.sequelize.query(
        'ALTER TABLE ban.common_toponym_h ALTER COLUMN "updateDate" SET NOT NULL;'
      )
      await queryInterface.sequelize.query(
        'ALTER TABLE ban.address_h ALTER COLUMN "updateDate" SET NOT NULL;'
      )
    } catch (error) {
      console.error(error)
      throw error
    }
  },
}