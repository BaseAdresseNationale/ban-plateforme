'use strict';

const {POSTGRES_BAN_USER} = process.env

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_preferences', {
      id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        allowNull: false,
        comment: 'Le sub ProConnect'
      },
      data: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Données utilisateur'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()')
      }
    }, {
      schema: 'ban'
    });

    // Index GIN sur le champ data
    await queryInterface.addIndex({tableName: 'user_preferences', schema: 'ban'}, ['data'], {
      using: 'GIN',
      name: 'idx_user_preferences_data'
    });

    // Index GIN spécifique sur les favoris pour optimiser les recherches
    await queryInterface.sequelize.query(
      'CREATE INDEX idx_user_preferences_favorites ON ban.user_preferences USING GIN ((data->\'favorites\'));'
    );

    // Grant permissions to ban user
    await queryInterface.sequelize.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ban.user_preferences TO "${POSTGRES_BAN_USER}";`)
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable({tableName: 'user_preferences', schema: 'ban'});
  }
};
