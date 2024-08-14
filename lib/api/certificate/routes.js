import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import {
  getCertificate,
  setCertificate,
  checkCertifiedActiveAndHasParcellesById
} from './models.js'

const app = new express.Router()
app.use(express.json())

app.get('/:id', async (req, res) => {
  const id = req.params.id // eslint-disable-line prefer-destructuring
  try {
    // eslint-disable-next-line unicorn/prefer-regexp-test, unicorn/better-regex
    if (id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      const certificate = await getCertificate(id)
      if (certificate) {
        console.log(`Certificate retrieved: ${JSON.stringify(certificate)}`)
        res.status(200).json(certificate)
      } else {
        console.log(`Certificate not found with ID: ${id}`)
        res.status(404).json({message: 'Certificate not found'})
      }
    } else {
      res.status(400).json({message: 'Invalid UUID format'})
    }
  } catch (error) {
    console.error(`Error retrieving certificate: ${error.message}`)
    res.status(500).json({message: 'Internal server error'})
  }
})

app.post('/', async (req, res) => {
  try {
    const {address_id: addressID} = req.body

    if (!addressID) {
      return res.status(400).json({message: 'address_id is required'})
    }

    const isValidAddress = await checkCertifiedActiveAndHasParcellesById(addressID)

    if (!isValidAddress) {
      return res.status(400).json({message: 'Address is not certified, not active, or has no parcels.'})
    }

    const newCertificate = await setCertificate([{
      address_id: addressID // eslint-disable-line camelcase
    }])

    res.status(201).json(newCertificate[0])
  } catch (error) {
    console.error(`Error creating certificate: ${error.message}`)
    res.status(500).json({message: 'Internal server error'})
  }
})

export default app
