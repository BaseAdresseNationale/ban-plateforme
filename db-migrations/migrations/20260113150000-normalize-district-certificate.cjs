'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.sequelize.query(`
        UPDATE ban.district
        SET config = CASE
          -- Si config est NULL ou {} vide → {"certificate": "DISABLED"}
          WHEN config IS NULL OR config = '{}'::jsonb 
            THEN '{"certificate": "DISABLED"}'::jsonb
          
          -- Si certificate existe et vaut {} → remplacer par "ALL"
          WHEN config ? 'certificate' AND config->'certificate' = '{}'::jsonb
            THEN jsonb_set(config, '{certificate}', '"ALL"')
          
          -- Si certificate n'existe pas → ajouter "certificate": "DISABLED"
          WHEN NOT (config ? 'certificate')
            THEN jsonb_set(config, '{certificate}', '"DISABLED"')
          
          -- Sinon garder tel quel
          ELSE config
        END
        ;`,
      {transaction})
      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.sequelize.query(`
        UPDATE ban.district
        SET config = CASE
          -- Si config = {"certificate": "DISABLED"} tout seul → remettre NULL
          WHEN config = '{"certificate": "DISABLED"}'::jsonb
            THEN NULL
          
          -- Si certificate vaut "ALL" → remettre {} (objet vide)
          WHEN config->>'certificate' = 'ALL'
            THEN jsonb_set(config, '{certificate}', '{}'::jsonb)
          
          -- Si certificate vaut "DISABLED" et il y a d'autres clés → supprimer certificate
          WHEN config->>'certificate' = 'DISABLED'
            THEN config - 'certificate'
          
          -- Sinon garder tel quel
          ELSE config
        END
        ;`,
      {transaction})
      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  }
}

