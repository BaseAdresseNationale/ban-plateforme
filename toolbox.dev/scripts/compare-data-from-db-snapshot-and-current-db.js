import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import fs from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import path, {dirname} from 'node:path'
import lodash from 'lodash'
import deepDiff from 'deep-diff'
import mongo from '../../lib/util/mongo.cjs'

const DISTRICT_TO_SNAPSHOT = (process.env.DISTRICT_TO_SNAPSHOT)?.split(',') || []

const SNAPSHOT_FOLDER_NAME = 'ban-db-snapshot'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const main = async () => {
  await mongo.connect()

  // Read the files in the snapshot folder
  const snapshotFolder = path.join(__dirname, '../data', SNAPSHOT_FOLDER_NAME)
  const files = await fs.readdir(snapshotFolder)

  // Loop through each file and compare the data with the data from the database
  const resultPromises = files.map(async file => {
    const collectionName = path.basename(file, '.json')
    const collection = mongo.db.collection(collectionName)

    const filePath = path.join(snapshotFolder, file)
    const fileData = JSON.parse(await fs.readFile(filePath))

    const dbData = DISTRICT_TO_SNAPSHOT.length > 0
      ? await collection.find({codeCommune: {$in: DISTRICT_TO_SNAPSHOT}}).toArray()
      : await collection.find().toArray()

    const fileDataFiltered = filterData(collectionName, fileData)
    const dbDataFiltered = filterData(collectionName, dbData)

    let report
    const isEqual = lodash.isEqual(fileDataFiltered, dbDataFiltered)

    if (!isEqual) {
      const idKey = getIdKey(collectionName)
      const added = {count: 0, detail: {}}
      const modified = {count: 0, detail: {}}
      const deleted = {count: 0, detail: {}}

      // Find added and modified items
      dbDataFiltered.forEach(item => {
        const itemIdKey = item[idKey]
        const fileItem = fileDataFiltered.find(fileItem => fileItem[idKey] === itemIdKey)
        if (!fileItem) {
          added.count++
          added.detail[itemIdKey] = {...item}
        } else if (!lodash.isEqual(item, fileItem)) {
          const diff = deepDiff.diff(item, fileItem)
          modified.count++
          modified.detail[itemIdKey] = {...diff}
        }
      })

      // Find deleted items
      fileDataFiltered.forEach(item => {
        const itemIdKey = item[idKey]
        const dbItem = dbDataFiltered.find(dbItem => dbItem[idKey] === itemIdKey)
        if (!dbItem) {
          deleted.count++
          deleted.detail[itemIdKey] = {...item}
        }
      })

      report = {
        added: added.count ? added : undefined,
        modified: modified.count ? modified : undefined,
        deleted: deleted.count ? deleted : undefined
      }
    }

    return {collectionName, snapshotDataCount: fileData.length, dbDataCount: dbData.length, isEqual, report}
  })
  const results = await Promise.all(resultPromises)

  // Write the result to a file
  const resultPath = path.join(__dirname, '../data', 'compare-results.json')
  await fs.writeFile(resultPath, JSON.stringify(results, null, 2))
  mongo.disconnect()
}

const filterData = (collectionName, data) => {
  if (collectionName === 'communes') {
    return data.map(({_id, dateRevision, idRevision, composedAt, compositionAskedAt, compositionOptions, ...rest}) => ({...rest}))
  }

  if (collectionName === 'numeros') {
    return data.map(({_id, adressesOriginales, ...rest}) => ({...rest}))
  }

  return data.map(({_id, ...rest}) => ({...rest}))
}

const getIdKey = collectionName => {
  switch (collectionName) {
    case 'communes':
      return 'codeCommune'
    case 'voies':
      return 'idVoie'
    case 'numeros':
      return 'id'
    case 'pseudo_codes_voies':
      return 'codeVoie'
    default:
      return null
  }
}

main()
