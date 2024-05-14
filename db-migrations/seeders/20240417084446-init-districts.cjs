'use strict'

const districts = [
  {
    id: '55c7f562-4f6b-4dac-a685-19efd9afe42c',
    labels: [{isoCode: 'fra', value: 'Thourotte'}],
    updateDate: '2023-01-01',
    meta: {insee: {cog: '60636'}}
  },
]

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO ban.district (id, labels, "updateDate", meta) 
      VALUES 
        ${districts.map(({id, labels, updateDate, meta}) => (`
          (
            '${id}', 
            (ARRAY['${labels.map(label => JSON.stringify(label)).join(',')}'])::jsonb[],
            '${updateDate}',
            '${JSON.stringify(meta)}'::jsonb
          )`)).join(',')}
      ;`)
  },

  async down(queryInterface) {
    return queryInterface.bulkDelete({tableName: 'district', schema: 'ban'}, null, {})
  }
}
