import express from 'express'
import queue from '../../util/queue.cjs'
import {handleAPIResponse} from '../helper.js'
import {getJobStatus} from './models.js'

const apiQueue = queue('api')

const app = new express.Router()

app.get('/:statusID', async (req, res) => {
  try {
    const {statusID} = req.params
    if (!statusID) {
      handleAPIResponse(res, 400, 'Request ID missing', {})
    }

    const job = await apiQueue.getJob(statusID)
    if (job) {
      const status = job?.processedOn ? 'processing' : 'pending'
      handleAPIResponse(res, 200, 'Job status has not been yet processed', {status})
    } else {
      const jobStatus = await getJobStatus(statusID)
      if (jobStatus) {
        const {id, ...jobStatusBody} = jobStatus
        if (jobStatusBody) {
          handleAPIResponse(res, 200, 'Job status has been processed', jobStatusBody)
        }
      } else {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
      }
    }
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
