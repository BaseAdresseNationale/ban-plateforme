import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import fs from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path, {dirname} from 'node:path'
import mongo from '../../lib/util/mongo.cjs'

const DISTRICT_TO_SNAPSHOT = (process.env.DISTRICT_TO_SNAPSHOT)?.split(',') || []

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SNAPSHOT_FOLDER_NAME = 'ban-db-snapshot'

const collectionNotToSnapshot = new Set(
  ['metrics', 'sources_adresses', 'sources_voies', 'sources_communes', 'sources_parts', 'address_test', 'commonToponym_test', 'district_test', 'job_status']
)

const main = async () => {
  console.log('Starting db snapshot script...')
  if (DISTRICT_TO_SNAPSHOT.length > 0) {
    console.log(`Snapshoting data for districts: ${DISTRICT_TO_SNAPSHOT.join(', ')}`)
  } else {
    console.log('Snapshoting all data')
  }

  await mongo.connect()
  const initDir = path.join(__dirname, '../data', SNAPSHOT_FOLDER_NAME)

  await initFolder(initDir)
  const collections = await mongo.db.listCollections().toArray()
  const collectionNames = collections.map(collection => collection.name)

  const writeFilePromises = collectionNames.map(async collectionName => {
    if (collectionNotToSnapshot.has(collectionName)) {
      return
    }

    const collection = mongo.db.collection(collectionName)
    const data = DISTRICT_TO_SNAPSHOT
      ? await collection.find({codeCommune: {$in: DISTRICT_TO_SNAPSHOT}}).toArray()
      : await collection.find().toArray()
    const filePath = path.join(initDir, `${collectionName}.json`)
    return fs.writeFile(filePath, JSON.stringify(data, null, 2))
  })

  await Promise.all(writeFilePromises)
  mongo.disconnect()
}

async function initFolder(dir) {
  try {
    await fs.access(dir)
    console.log('Data folder already exists.')
    console.log('Deleting files inside folder.')
    const files = await fs.readdir(dir)
    const promises = files.map(async file => {
      const filePath = path.join(dir, file)
      await fs.unlink(filePath)
    })
    await Promise.all(promises)
    console.log('All files deleted.')
  } catch {
    try {
      await fs.mkdir(dir, {recursive: true})
      console.log('Data folder created successfully!')
    } catch (error) {
      console.error(`Error creating ${dir} folder: ${error}`)
    }
  }
}

main()
