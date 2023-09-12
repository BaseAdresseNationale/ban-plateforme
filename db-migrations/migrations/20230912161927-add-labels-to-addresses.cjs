'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Addresses', 'labels', {
      type: Sequelize.ARRAY(Sequelize.JSONB),
      allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Addresses', 'labels')
  }
}
