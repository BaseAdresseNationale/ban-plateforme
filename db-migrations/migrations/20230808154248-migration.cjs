'use strict'

const fs = require('fs')
const path = require('path')

const dataBackupFolderPath = path.join(__dirname, './data-backup')

module.exports = {
  async up(queryInterface, Sequelize) {
    const data = await queryInterface.sequelize.query(
      'SELECT type, id FROM "CommonToponyms"',
      {type: Sequelize.QueryTypes.SELECT}
    )

    // Convert data to JSON
    const jsonData = JSON.stringify(data)

    // Define the path for the backup file
    const dataBackupFilePath = path.join(dataBackupFolderPath, '20230808154248-migration-data.json')

    if (!fs.existsSync(dataBackupFolderPath)) {
      fs.mkdirSync(dataBackupFolderPath)
    }

    // Write the data to the backup file
    fs.writeFileSync(dataBackupFilePath, jsonData)

    await queryInterface.removeColumn('CommonToponyms', 'type')
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('CommonToponyms', 'type', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
    })

    // Restore data from the backup file if needed
    const backupFilePath = path.join(__dirname, './data-backup', '20230808154248-migration-data.json')
    const jsonData = fs.readFileSync(backupFilePath, 'utf8')
    const data = JSON.parse(jsonData)

    // Insert data back into the column
    const promises = data.map(item => {
      const typeString = JSON.stringify(item.type)
      return queryInterface.sequelize.query(
        'UPDATE "CommonToponyms" SET type = ? WHERE id = ?',
        {replacements: [typeString, item.id]}
      )
    })

    await Promise.all(promises)

    // Alter column constraint to be non-nullable
    await queryInterface.changeColumn('CommonToponyms', 'type', {
      type: Sequelize.JSONB,
      allowNull: false,
    })

    // Remove the backup file
    fs.unlinkSync(backupFilePath)
  }
}
