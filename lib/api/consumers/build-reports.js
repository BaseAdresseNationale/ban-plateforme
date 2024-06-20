import mongo from '../../util/mongo.cjs'
import {formatAndUpdateReports} from '../report/utils.js'

const buildReportsConsumer = async () => {
  try {
    console.log('Building reports...')
    const filters = {
      status: null,
      preProcessingStatusKey: 0,
      'meta.targetedPlateform': 'ban',
      preProcessingResponse: {$ne: {}}
    }

    const reportsNotCompletelyBuilt = await mongo.db.collection('processing_reports').find({...filters}).toArray()
    await formatAndUpdateReports(reportsNotCompletelyBuilt)
    console.log('Reports built successfully')
  } catch (error) {
    console.error(error)
  }
}

export default buildReportsConsumer
