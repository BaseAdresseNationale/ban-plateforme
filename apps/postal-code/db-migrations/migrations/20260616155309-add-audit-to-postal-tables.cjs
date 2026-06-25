'use strict';
const { env } = require('@ban/config')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.addColumn(
        { schema: 'postal', tableName: 'postal_area' },
        'updatedBy',
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      )
      await queryInterface.addColumn(
        { schema: 'postal', tableName: 'postal_area' },
        'updateNote',
        { type: Sequelize.TEXT, allowNull: true },
        { transaction }
      )
      await queryInterface.addColumn(
        { schema: 'postal', tableName: 'datanova' },
        'updatedBy',
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      )

      await queryInterface.createTable('postal_area_audit', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        postalAreaId: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        previousPostalCode: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        previousGeometry: {
          type: Sequelize.GEOMETRY,
          allowNull: false,
        },
        changedBy: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        changedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        changeNote: {
          type: Sequelize.TEXT,
          allowNull: true,
        },


      }, {
        schema: 'postal',
        ifNotExists: true,
      })

      await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION postal.log_postal_area_update()
        RETURNS TRIGGER AS $$
        BEGIN
          INSERT INTO postal.postal_area_audit (
            "postalAreaId",
            "previousPostalCode",
            "changedAt",
            "changedBy",
            "changeNote",
            "previousGeometry"
          ) VALUES (
            OLD.id,
            OLD."postalCode",
            NOW(),
            OLD."updatedBy",
            OLD."updateNote",
            OLD.geometry
          );
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `, { transaction })

      await queryInterface.sequelize.query(`
        CREATE TRIGGER audit_postal_area_update
        BEFORE DELETE ON postal.postal_area
        FOR EACH ROW
        EXECUTE FUNCTION postal.log_postal_area_update();
      `, { transaction })

      await queryInterface.sequelize.query(`
        GRANT UPDATE ON postal.postal_area TO "${env.PG.user}";
        GRANT INSERT ON postal.postal_area_audit TO "${env.PG.user}";
        GRANT SELECT ON postal.postal_area_audit TO "${env.PG.user}";
      `, { transaction })
      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  },

  async down (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.sequelize.query(
        'DROP TRIGGER IF EXISTS audit_postal_area_update ON postal.postal_area;',
        { transaction }
      )
      await queryInterface.sequelize.query(
        'DROP FUNCTION IF EXISTS postal.log_postal_area_update();',
        { transaction }
      )
      await queryInterface.dropTable(
        { schema: 'postal', tableName: 'postal_area_audit' },
        { transaction }
      )
      await queryInterface.removeColumn(
        { schema: 'postal', tableName: 'postal_area' }, 'updatedBy', { transaction }
      )
      await queryInterface.removeColumn(
        { schema: 'postal', tableName: 'postal_area' }, 'updateNote', { transaction }
      )
      await queryInterface.removeColumn(
        { schema: 'postal', tableName: 'datanova' }, 'updatedBy', { transaction }
      )
      await transaction.commit()
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  }
};
