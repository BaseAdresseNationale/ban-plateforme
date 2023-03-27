const {customAlphabet} = require('nanoid')
const express = require('express')
const addressQueue = require('../../util/queue.cjs')('address')
const {authMiddleware: auth} = require('../../middleware/auth.cjs')
const {getAddress, getAdressJobStatus} = require('./models.cjs')

require('dotenv').config()

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr'

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()
app.use(express.json())

app.get('/:addressID', async (req, res) => {
  let response
  try {
    const {addressID} = req.params
    const address = await getAddress(addressID)

    if (!address) {
      res.status(404).send('Request ID unknown')
      return
    }

    const {_id, ...addressBody} = address
    response = {
      date: new Date(),
      status: 'success',
      response: {...addressBody},
    }
  } catch (error) {
    const {message} = error
    response = {
      date: new Date(),
      status: 'error',
      message,
      response: {},
    }
  }

  res.send(response)
})

app.post('/', auth, async (req, res) => {
  let response
  try {
    const addresses = req.body
    const statusID = nanoid()

    await addressQueue.add(
      {type: 'insert', addresses, statusID},
      {jobId: statusID, removeOnComplete: true}
    )
    response = {
      date: new Date(),
      status: 'success',
      message: `Check the status of your request : ${BAN_API_URL}/address/status/${statusID}`,
      response: {statusID},
    }
  } catch (error) {
    response = {
      date: new Date(),
      status: 'error',
      message: error,
      response: {},
    }
  }

  res.send(response)
})

app.get('/status/:statusID', async (req, res) => {
  let response
  try {
    const {statusID} = req.params
    const job = await addressQueue.getJob(statusID)

    if (job) {
      const status = job?.processedOn ? 'processing' : 'pending'
      response = {status}
    } else {
      const jobStatus = await getAdressJobStatus(statusID)
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

module.exports = app