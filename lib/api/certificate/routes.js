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

/**
 * @swagger
 * tags:
 *   name: Certificat
 *   description: API de gestion des certificats
 */

/**
 * @swagger
 * /api/certificate/{id}:
 *   get:
 *     summary: Récupérer un certificat par ID
 *     description: Permet de récupérer le certificat associé à l'ID fourni.
 *     tags:
 *       - Certificat
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant unique du certificat à récupérer.
 *         example: "abc123"
 *     responses:
 *       200:
 *         description: The requested certificate.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 data:
 *                   type: object
 *       404:
 *         description: Certificate not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Certificate not found
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

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

/**
 * @swagger
 * /api/certificate/:
 *   post:
 *     summary: Créer un nouveau certificat
 *     description: Génère un certificat pour l'ID d'adresse fourni, si tous les critères sont remplis. Requiert une authentification.
 *     tags:
 *       - Certificat
 *     security:
 *       - bearerAuth: [] # Secured with Bearer token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               addressID:
 *                 type: string
 *                 description: Identifiant unique de l'adresse à certifier.
 *                 example: "12345"
 *     responses:
 *       201:
 *         description: The newly created certificate.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input or address configuration issue.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Address is not certified, active, or has no parcels.
 *       401:
 *         description: Unauthorized.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Authentication required.
 *       403:
 *         description: Forbidden. Insufficient permissions.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User does not have permission to create a certificate.
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Internal server error
 */

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
