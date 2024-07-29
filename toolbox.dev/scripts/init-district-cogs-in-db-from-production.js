/* eslint-disable no-await-in-loop */
import fetch from 'node-fetch'
import {init, District, sequelize} from '../../lib/util/sequelize.js'
import mongo from '../../lib/util/mongo.cjs'

const BAN_API_PRODUCTION_URL = 'https://plateforme.adresse.data.gouv.fr/api'

const main = async () => {
  await init()
  await mongo.connect()
  const cogs = process.argv.slice(2)
  for (const cog of cogs) {
    try {
      const response = await fetch(`${BAN_API_PRODUCTION_URL}/district/cog/${cog}`)
      if (!response.ok) {
        const message = await response.text()
        throw new Error(`Error while fetching district cog ${cog} : ${message}`)
      }

      const district = (await response.json())?.response?.[0]
      const formattedDistrictForMainDB = formatDistrictForMainDB(district)
      const districtID = formattedDistrictForMainDB.id
      console.log(`District id ${districtID} (cog : ${cog}) fetched from production API`)
      await District.bulkCreate([formattedDistrictForMainDB], {updateOnDuplicate: ['id']})
      console.log(`District ${districtID} (cog : ${cog}) created or updated in local main database (postgresql)`)
      const formattedDistrictForExploitationDB = formatDistrictForExploitationDB(district)
      await mongo.db.collection('communes').updateOne({codeCommune: cog}, {$set: formattedDistrictForExploitationDB}, {upsert: true})
      console.log(`District ${districtID} (cog : ${cog}) created or updated in local exploitation database (mongodb)`)
    } catch (error) {
      console.error(error)
    }
  }

  await mongo.disconnect()
  await sequelize.close()
}

const formatDistrictForMainDB = district => {
  const {isActive, lastRecordDate, ...districtRest} = district
  districtRest.updateDate = new Date(districtRest.updateDate)
  districtRest.config = districtRest.config || {}
  return districtRest
}

const formatDistrictForExploitationDB = district => (
  {
    codeCommune: district.meta.insee.cog,
    banId: district.id,
    nomCommune: district.labels.find(label => label.isoCode === 'fra').value || district.labels[0].value,
  }
)

main()
