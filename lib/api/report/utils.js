import {PromisePool} from '@supercharge/promise-pool'
import mongo from '../../util/mongo.cjs'
import {getJobStatus} from '../job-status/models.js'

const categories = ['addresses', 'commonToponyms', 'districts']
const operations = ['add', 'update', 'delete']

// Status key:  0 = success, 1 = error, -1 = unknown

export const formatReportToInsert = (districtID, report) => {
  const {preProcessingDate, ...rest} = report
  return {
    districtID,
    ...rest,
    ...(preProcessingDate ? {preProcessingDate: new Date(preProcessingDate)} : {}),
  }
}

export const formatAndUpdateReports = async reports => {
  const {results} = await PromisePool
    .withConcurrency(10)
    .for(reports)
    .process(formatAndUpdateReport)
  return results
}

const formatAndUpdateReport = async report => {
  const {_id, ...reportRest} = report
  const {status, preProcessingStatusKey, preProcessingResponse, meta: {targetedPlateform}} = reportRest
  // If the report does not have a final status yet and the pre-processing status is in success, we need to reconstruct.
  // the flag 'targetedPlateform' is used to determine if the pre-processing data has been sent to the ban APIs or the legacy compose API
  // Our ban APIs are asynchronous so the preprocessing report need to be reconstructed to get the final status
  if (!status && preProcessingStatusKey === 0
      && targetedPlateform === 'ban'
      && Object.keys(preProcessingResponse).length > 0
  ) {
    try {
      let errorCount = 0
      let mostRecentDate = new Date(0)
      const formattedResponse = {}

      for (const category of categories) {
        for (const operation of operations) {
          if (!preProcessingResponse[category] || !preProcessingResponse[category][operation]) { // eslint-disable-line max-depth
            continue
          }

          formattedResponse[category] ??= {}
          const jobStatusArr = await Promise.all( // eslint-disable-line no-await-in-loop
            preProcessingResponse[category][operation].map(async report => {
              const statusID = report?.response?.statusID
              if (!statusID) {
                throw new Error('Missing statusID in pre-processing report response')
              }

              const jobStatus = await getJobStatus(statusID)
              if (!jobStatus) {
                throw new Error(`Job status ${report.response.statusID} not found : either pending or expired`)
              }

              return jobStatus
            })
          )

          formattedResponse[category][operation] = jobStatusArr.reduce((acc, jobStatus) => {
            const {status, count, report, updatedAt} = jobStatus

            const date = new Date(updatedAt)
            if (date > mostRecentDate) {
              mostRecentDate = date
            }

            if (status === 'error') {
              errorCount++
              acc.error = {
                count: acc.error ? acc.error.count + count : count,
                report: [...acc.error.report, report],
              }
            }

            if (status === 'success') {
              acc.success = {
                count: acc.success ? acc.success.count + count : count,
              }
            }

            return acc
          }, {
            success: {
              count: 0,
            },
            error: {
              count: 0,
              report: []
            },
          })
        }
      }

      const processingReport = {
        statusKey: errorCount ? 1 : 0,
        status: errorCount ? 'error' : 'success',
        message: errorCount ? 'Processed with errors' : 'Processed successfully',
        response: formattedResponse,
        date: mostRecentDate
      }

      // Update the report with the processing report
      await mongo.db.collection('processing_reports').updateOne({_id}, {$set: {...processingReport}})

      return {
        ...reportRest,
        ...processingReport
      }
    } catch (error) {
      const message = `Could not process the report : ${error.message}`
      console.log(message)
      const processingReport = {
        statusKey: -1,
        status: 'error',
        message,
        response: {},
        date: new Date()
      }

      return {
        ...reportRest,
        ...processingReport
      }
    }
  }

  return reportRest
}
