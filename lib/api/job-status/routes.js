import express from 'express'
import queue from '../../util/queue.cjs'
import {getJobStatus} from '../job-status/models.js'

const apiQueue = queue('api')

const app = new express.Router()

app.get('/:statusID', async (req, res) => {
  let response
  try {
    const {statusID} = req.params
    const job = await apiQueue.getJob(statusID)

    if (job) {
      const status = job?.processedOn ? 'processing' : 'pending'
      response = {status}
    } else {
      const jobStatus = await getJobStatus(statusID)
      if (jobStatus) {
        const {_id, id, ...jobStatusBody} = jobStatus
        if (jobStatusBody) {
          response = jobStatusBody
        }
      }
    }

    if (!response) {
      return res.status(404).send('Request ID unknown')
    }
  } catch (error) {
    const {message} = error
    response = {
      status: 'error',
      message,
    }
  }

  res.send(response)
})

export default app
