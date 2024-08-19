import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import auth from '../../middleware/auth.js'
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
    if (certificate) {
      res.status(200).json(certificate)
    } else {
      res.status(404).json({message: 'Certificate not found'})
    }
  } catch (error) {
    console.error(`Error retrieving certificate: ${error.message}`)
    res.status(500).json({message: 'Internal server error'})
  }
})

app.post('/', auth, async (req, res) => {
  try {
    const {addressID} = req.body

    if (!addressID) {
      return res.status(400).json({message: 'addressID is required'})
    }

    const data = await getDataForCertificate(addressID)

    if (!data) {
      return res.status(400).json({message: 'Address is not certified, not active, or has no parcels.'})
    }

    const {districtConfig} = data
    if (!districtConfig.certificate) {
      return res.status(400).json({message: 'District has not activated the certificate config.'})
    }

    const certificate = await formatDataForCertificate(data)
    const newCertificate = await setCertificate(certificate)

    res.status(201).json(newCertificate)
  } catch (error) {
    console.error(`Error creating certificate: ${error.message}`)
    res.status(500).json({message: 'Internal server error'})
  }
})

export default app
