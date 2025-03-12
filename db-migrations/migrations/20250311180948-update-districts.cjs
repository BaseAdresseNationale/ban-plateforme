'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface) {
    try{
      const transaction = await queryInterface.sequelize.transaction();
      await queryInterface.sequelize.query(`
        update ban.district
        set meta = jsonb_set(
                  meta, 
                  '{insee}', 
                  meta->'insee' || jsonb_build_object(
                    'mainCog', meta->'insee'->>'cog',
                    'isMain', true::bool,
                    'mainId', id
                  )
                )
        ;`,
        { transaction })
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down (queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try{
      await queryInterface.sequelize.query(`
        update ban.district
        set meta = jsonb_set(
                  meta, 
                  '{insee}', 
                  jsonb_build_object(
                    'cog', meta->'insee'->>'cog'
                  )
                )
        ;`,
          { transaction })
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  }
};
