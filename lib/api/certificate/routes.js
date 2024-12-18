import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import auth from '../../middleware/auth.js'
import {handleAPIResponse} from '../helper.js'
import {
  getCertificate,
  setCertificate,
  getDataForCertificate
} from './models.js'
import {formatDataForCertificate} from './utils.js'

const app = new express.Router()
app.use(express.json())

app.get('/:id', async (req, res) => {
  const {id} = req.params
  try {
    const certificate = await getCertificate(id)
    if (!certificate) {
      handleAPIResponse(res, 404, 'Certificate not found', {})
      return
    }

    handleAPIResponse(res, 200, 'Certificate retrieved', certificate)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

app.post('/', auth, async (req, res) => {
  try {
    const {addressID} = req.body
    if (!addressID) {
      handleAPIResponse(res, 400, 'addressID is required', {})
      return
    }

    const data = await getDataForCertificate(addressID)
    if (!data) {
      handleAPIResponse(res, 403, 'Address is not certified, not active, or has no parcels.', {})
      return
    }

    const {districtConfig} = data
    if (!districtConfig.certificate) {
      handleAPIResponse(res, 403, 'District has not activated the certificate config.', {})
      return
    }

    const certificate = await formatDataForCertificate(data)
    const newCertificate = await setCertificate(certificate)

    handleAPIResponse(res, 201, 'Certificate created', newCertificate)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
