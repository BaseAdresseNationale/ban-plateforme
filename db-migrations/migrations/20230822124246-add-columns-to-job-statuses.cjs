'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('JobStatuses', 'dataType', {
      type: Sequelize.STRING,
      allowNull: true,
    })

    await queryInterface.addColumn('JobStatuses', 'jobType', {
      type: Sequelize.STRING,
      allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('JobStatuses', 'dataType')
    await queryInterface.removeColumn('JobStatuses', 'jobType')
  },
}
