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
 * /api/certificate/{id}:
 *   get:
 *     summary: Récupérer un certificat par ID
 *     description: Permet de récupérer le certificat associé à l'ID fourni.
 *     tags:
 *       - 📜 Certificats d’adressage
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant unique du certificat à récupérer.
 *         example: "24792252-c345-46f7-8fd5-a7063de6fa73"
  *     responses:
 *       200:
 *         description: The requested certificate.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   description: The response date.
 *                 status:
 *                   type: string
 *                   description: The response status, which will be "success" for a successful request.
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: A message indicating the certificate was retrieved.
 *                   example: "Certificate successfully retrieved"
 *                 response:
 *                    $ref: '#/components/schemas/TYPE_json_ban_certificate'
 *       400:
 *         description: The request is invalid. The identifier is missing or incorrect.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 status:
 *                   type: string
 *                   description: The response status, which will be "error" in case of an error.
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   description: A message indicating the identifier is missing or incorrect.
 *                   example: "Wrong request format"
 *                 response:
 *                   type: object
 *                   description: An empty object or additional error information.
 *       404:
 *         description: Certificate not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 status:
 *                   type: string
 *                   description: The response status, which will be "error" in case of an error.
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   description: A message certificate the certificate was not found.
 *                   example: "Request ID unknown"
 *                 response:
 *                   type: object
 *                   description: An empty object or additional error information.
 *       500:
 *         description: Internal server error. A problem occurred while processing the request.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 status:
 *                   type: string
 *                   description: The response status, which will be "error" in case of an internal error.
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   description: A detailed message about the internal server error.
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 *                   description: An empty object or additional error information.
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
 *     description: |
 *       Génère un certificat pour l'ID d'adresse fourni, si tous les critères sont remplis.
 *       Cette action requiert une authentification avec un jeton Bearer.
 *     tags:
 *       - 📜 Certificats d’adressage
 *     security:
 *       - bearerAuth: [] # Sécurisé avec un jeton Bearer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - addressID
 *             properties:
 *               addressID:
 *                 type: string
 *                 description: Identifiant unique de l'adresse à certifier.
 *                 example: "a950efd3-69e7-41df-b5d8-a47dc660b66e"
 *     responses:
 *       201:
 *         description: Certificat créé avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Identifiant unique du certificat généré.
 *                   example: "c1b2a3d4-e5f6-7890-abcd-ef1234567890"
 *                 data:
 *                   type: object
 *                   properties:
 *                     addressID:
 *                       type: string
 *                       example: "a950efd3-69e7-41df-b5d8-a47dc660b66e"
 *                     addressNumber:
 *                       type: string
 *                       example: "12"
 *                     addressSuffix:
 *                       type: string
 *                       example: "B"
 *                     commonToponymDefaultLabel:
 *                       type: string
 *                       example: "Rue de la Paix"
 *                     districtDefaultLabel:
 *                       type: string
 *                       example: "Quartier Nord"
 *                     lieuDitComplementNomDefaultLabel:
 *                       type: string
 *                       example: "Lotissement Bellevue"
 *                     districtCog:
 *                       type: string
 *                       example: "75056"
 *                     districtConfig:
 *                       type: object
 *                       properties:
 *                         certificate:
 *                           type: boolean
 *                           example: true
 *                     cadastreIDs:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["1234567890123", "9876543210987"]
 *       400:
 *         description: Requête invalide (données manquantes ou incorrectes).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "addressID is required."
 *       401:
 *         description: Non autorisé (authentification requise).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Authentication required."
 *       403:
 *         description: Accès refusé (permissions insuffisantes ou configuration manquante).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User does not have permission to create a certificate."
 *       404:
 *         description: Adresse introuvable ou non certifiable.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Address is not certified, not active, or has no parcels."
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error."
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
