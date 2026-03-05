import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import fetch from '../../util/fetch.cjs'
import analyticsMiddleware from '../../middleware/analytics.js'
import proConnectMiddleware from '../../middleware/pro-connect.js'
import {handleAPIResponse} from '../helper.js'
import {getCommonToponymsCountByDistrict} from '../common-toponym/models.js'
import {getAddressesCountByDistrict} from '../address/models.js'
import {enableDistrictAddressingCertification, disableDistrictAddressingCertification, isAuthorizedCog, addAuthorizedCogs, removeAuthorizedCogs, getAllAuthorizedCogs, patchDistricts} from '../district/models.js'
import {addAction} from '../action/models.js'
import {getCommune} from '../../models/commune.cjs'
import {getDistrict, getDistrictsFromCog, deleteDistrict} from './models.js'
import {formatDistrict} from './utils.js'

const apiQueue = queue('api')

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

const {
  API_IDFIX_TOKEN = '',
  API_IDFIX_URL = '',
  NODE_ENV = '',
} = process.env
const BAN_API_URL = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

/**
 * @swagger
 * /api/district/:
 *   post:
 *     summary: Ajouter des nouveaux districts
 *     description: |
 *       Ajoute un ou plusieurs nouveaux districts en fournissant une liste d'objets.
 *       Chaque district doit respecter la structure définie dans le schéma **TYPE_json_ban_district**.
 *     tags:
 *       -  🏙️ Districts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TYPE_json_ban_district'
 *     responses:
 *       200:
 *         description: Districts successfully added. Use the returned ID to track the status.
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
 *                   description: The status of the response.
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: Message with a URL to track the job status.
 *                   example: "Check the status of your request: https://plateforme.adresse.data.gouv.fr/api/job-status/CSMTD7C55"
 *                 response:
 *                   type: object
 *                   properties:
 *                     statusID:
 *                       type: string
 *                       exemple: "CSMTD7C55"
 *                       description: Unique identifier to track the request.
 *       400:
 *         description: Invalid request format or missing data.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Wrong request format"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       500:
 *         description: Internal server error during request processing.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 */
app.route('/')
  .post(auth, analyticsMiddleware, async (req, res) => {
    try {
      const districts = req.body
      if (!Array.isArray(districts)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'district', jobType: 'insert', data: districts, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
/**
 * @swagger
 * /api/district/:
 *   put:
 *     summary: Mettre à jour des districts existants
 *     description: |
 *       Met à jour un ou plusieurs districts existants en fournissant une liste d'objets.
 *       Chaque district doit respecter la structure définie dans le schéma **TYPE_json_ban_district**.
 *     tags:
 *       -  🏙️ Districts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TYPE_json_ban_district'
 *     responses:
 *       200:
 *         description: Districts successfully updated. Use the returned ID to track the status.
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
 *                   description: The status of the response.
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: Message with a URL to track the job status.
 *                   example: "Check the status of your request: https://plateforme.adresse.data.gouv.fr/api/job-status/CSMTD7C55"
 *                 response:
 *                   type: object
 *                   properties:
 *                     statusID:
 *                       type: string
 *                       exemple: "CSMTD7C55"
 *                       description: Unique identifier to track the request.
 *       400:
 *         description: Invalid request format or missing data.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Wrong request format"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       500:
 *         description: Internal server error during request processing.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 */
  .put(auth, analyticsMiddleware, async (req, res) => {
    try {
      const districts = req.body
      if (!Array.isArray(districts)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'district', jobType: 'update', data: districts, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
/**
 * @swagger
 * /api/district/:
 *   patch:
 *     summary: Modifier partiellement des districts existants
 *     description: |
 *       Permet de modifier partiellement un ou plusieurs districts en fournissant une liste d'objets avec les champs à mettre à jour.
 *       Chaque district doit respecter la structure définie dans le schéma **TYPE_json_ban_district_patch**.
 *     tags:
 *       -  🏙️ Districts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TYPE_json_ban_district_patch'
 *     responses:
 *       200:
 *         description: Districts successfully patched. Use the returned ID to track the status.
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
 *                   description: The status of the response.
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: Message with a URL to track the job status.
 *                   example: "Check the status of your request: https://plateforme.adresse.data.gouv.fr/api/job-status/CSMTD7C55"
 *                 response:
 *                   type: object
 *                   properties:
 *                     statusID:
 *                       type: string
 *                       exemple: "CSMTD7C55"
 *                       description: Unique identifier to track the request.
 *       400:
 *         description: Invalid request format or missing data.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Wrong request format"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       500:
 *         description: Internal server error during request processing.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 */
  .patch(auth, analyticsMiddleware, async (req, res) => {
    try {
      const districts = req.body
      if (!Array.isArray(districts)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'district', jobType: 'patch', data: districts, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

/**
 * @swagger
 * /api/district/{districtID}:
 *   get:
 *     summary: Récupérer les détails d'un district
 *     description: |
 *       Permet de récupérer les informations détaillées d'un district spécifique en utilisant son identifiant unique.
 *     tags:
 *       -  🏙️ Districts
 *     parameters:
 *       - name: districtID
 *         in: path
 *         required: true
 *         description: Identifiant unique du district à récupérer.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: District successfully retrieved.
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
 *                   description: The status of the response.
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: Message indicating the success of the request.
 *                   example: "District successfully retrieved"
 *                 response:
 *                     $ref: '#/components/schemas/TYPE_json_ban_district'
 *       400:
 *         description: Invalid request format or missing district ID.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Wrong request format"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       404:
 *         description: District not found with the provided ID.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Request ID unknown"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       500:
 *         description: Internal server error during request processing.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 */
app.route('/:districtID')
  .get(analyticsMiddleware, async (req, res) => {
    try {
      const {districtID} = req.params
      if (!districtID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const district = await getDistrict(districtID)
      if (!district) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      const districtFormatted = formatDistrict(district)
      handleAPIResponse(res, 200, 'District successfilly retrieved', districtFormatted)
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
/**
 * @swagger
 * /api/district/{districtID}:
 *   delete:
 *     summary: Supprimer un district
 *     description: |
 *       Supprime un district spécifique en utilisant son identifiant unique.
 *     tags:
 *       -  🏙️ Districts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: districtID
 *         in: path
 *         required: true
 *         description: Identifiant unique du district à supprimer.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: District successfully deleted.
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
 *                   description: The status of the response.
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: Message indicating the success of the deletion.
 *                   example: "District successfully deleted"
 *                 response:
 *                   type: object
 *                   description: Additional information, if any.
 *       400:
 *         description: Invalid request format or missing district ID.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Wrong request format"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       404:
 *         description: District not found with the provided ID.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Request ID unknown"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       500:
 *         description: Internal server error during request processing.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 */

  .delete(auth, analyticsMiddleware, async (req, res) => {
    try {
      const {districtID} = req.params
      if (!districtID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const district = await getDistrict(districtID)
      if (!district) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      await deleteDistrict(districtID)
      handleAPIResponse(res, 200, 'District successfully deleted', {})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
/**
 * @swagger
 * /api/district/delete:
 *   post:
 *     summary: Supprimer plusieurs districts
 *     description: |
 *       Supprime plusieurs districts en fournissant une liste d'identifiants de districts.
 *     tags:
 *       -  🏙️ Districts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *             example: ["districtID1", "districtID2", "districtID3"]
 *     responses:
 *       200:
 *         description: Request successfully received. Use the returned ID to track the status.
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
 *                   description: The status of the response.
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: Message with a URL to track the job status.
 *                   example: "Check the status of your request : https://plateforme.adresse.data.gouv.fr/api/job-status/CSMTD7C55"
 *                 response:
 *                   type: object
 *                   properties:
 *                     statusID:
 *                       type: string
 *                       exemple: "CSMTD7C55"
 *                       description: Unique identifier to track the request.
 *       400:
 *         description: Invalid request format or missing data.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Wrong request format"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       500:
 *         description: Internal server error during request processing.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 */

app.post('/delete', auth, analyticsMiddleware, async (req, res) => {
  try {
    const districtIDs = req.body
    if (!Array.isArray(districtIDs)) {
      handleAPIResponse(res, 400, 'Wrong request format', {})
      return
    }

    const statusID = nanoid()
    await apiQueue.add(
      {dataType: 'district', jobType: 'delete', data: districtIDs, statusID},
      {jobId: statusID, removeOnComplete: true}
    )
    handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})
/**
 * @swagger
 * /api/district/cog/{cog}:
 *   get:
 *     summary: Récupérer des districts par code COG
 *     description: |
 *       Récupère tous les districts associés à un code COG donné.
 *     tags:
 *       -  🏙️ Districts
 *     parameters:
 *       - in: path
 *         name: cog
 *         required: true
 *         description: Le code COG pour lequel récupérer les districts.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Districts successfully retrieved.
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
 *                   description: The status of the response.
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: Confirmation message.
 *                   example: "Districts successfully retrieved"
 *                 response:
 *                     $ref: '#/components/schemas/TYPE_json_ban_district'
 *       400:
 *         description: Invalid request format or missing COG.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Wrong request format"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       404:
 *         description: No districts found for the provided COG.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Request ID unknown"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       500:
 *         description: Internal server error during request processing.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 */

app.get('/cog/:cog', analyticsMiddleware, async (req, res) => {
  try {
    const {cog} = req.params
    if (!cog) {
      handleAPIResponse(res, 400, 'Wrong request format', {})
      return
    }

    const districts = await getDistrictsFromCog(cog)
    if (!districts || districts.length === 0) {
      handleAPIResponse(res, 404, 'Request ID unknown', {})
      return
    }

    const districtBodies = districts.map(district => formatDistrict(district))
    handleAPIResponse(res, 200, 'Districts successfully retrieved', districtBodies)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

/**
 * @swagger
 * /api/district/count/{districtID}:
 *   get:
 *     summary: Récupérer les compteurs d'un district
 *     description: |
 *       Permet de récupérer les nombres de CommonToponym et d'Adresses pour un district spécifique.
 *     tags:
 *       - 🏙️ Districts
 *     parameters:
 *       - name: districtID
 *         in: path
 *         required: true
 *         description: Identifiant unique du district pour lequel récupérer les compteurs.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Compteurs du district récupérés avec succès.
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
 *                   description: The status of the response.
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: Message indicating the success of the request.
 *                   example: "District counts successfully retrieved"
 *                 response:
 *                   type: object
 *                   properties:
 *                     districtID:
 *                       type: string
 *                       description: Identifiant du district
 *                     commonToponymCount:
 *                       type: integer
 *                       description: Nombre de CommonToponym dans ce district
 *                     addressCount:
 *                       type: integer
 *                       description: Nombre d'Adresses dans ce district
 *       400:
 *         description: Format de requête invalide ou ID de district manquant.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Wrong request format"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       404:
 *         description: District non trouvé avec l'ID fourni.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Request ID unknown"
 *                 response:
 *                   type: object
 *                   description: Additional error details.
 *       500:
 *         description: Erreur serveur interne lors du traitement de la requête.
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 */
app.route('/count/:districtID')
  .get(analyticsMiddleware, async (req, res) => {
    try {
      const {districtID} = req.params
      if (!districtID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      // Vérifier que le district existe
      const district = await getDistrict(districtID)
      if (!district) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      // Récupérer les compteurs
      const [commonToponymCount, addressCount] = await Promise.all([
        getCommonToponymsCountByDistrict(districtID),
        getAddressesCountByDistrict(districtID)
      ])

      const countsData = {
        districtID,
        commonToponymCount,
        addressCount
      }

      handleAPIResponse(res, 200, 'District counts successfully retrieved', countsData)
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

/**
 * @swagger
 * /api/district/addressing-certification/enable:
 *   patch:
 *     summary: Activer le certificat pour la commune
 *     description: |
 *       Permet d'activer le certificat pour la commune
 *     tags:
 *       - 🏙️ Districts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               districtID:
 *                   $ref : '#/components/schemas/TYPE_ban_id_district'
 *     responses:
 *       '200':
 *         description: addressing certification enabled for the district
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 districtID:
 *                   type: string
 *       '404':
 *         description: districtID not found
 *       '500':
 *         description: Internal server error
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
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 */
async function rollbackDistrictConfigOnRepublicationError(districtID, certificateType, config, oldConfig) {
  if (certificateType && !config) {
    await disableDistrictAddressingCertification(districtID)
  } else if (config) {
    await patchDistricts([{
      id: districtID,
      config: oldConfig
    }])
  }
}

app.patch('/addressing-certification/enable',
  [auth, proConnectMiddleware, analyticsMiddleware],
  async (req, res) => {
    try {
      const {
        districtID,
        siren,
        certificateType,
        config
      } = req.body

      if (!districtID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const district = await getDistrict(districtID)
      if (!district) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      const commune = await getCommune(district?.meta?.insee?.cog)
      if (!commune) {
        handleAPIResponse(res, 404, 'La commune n’existe pas', {})
        return
      }

      // Vérifier withBanId seulement si on modifie certificate
      const isModifyingCertificate = (config && config.certificate !== undefined) || certificateType
      if (isModifyingCertificate && !commune?.withBanId) {
        handleAPIResponse(res, 404, 'La commune ne remplit pas les conditions techniques pour activer la certification d\'adressage', {})
        return
      }

      const oldConfig = district.config || {}

      if (config && Object.keys(config).length > 0) {
        await patchDistricts([{
          id: districtID,
          config
        }])
      } else if (certificateType) {
        const activationDistrictAddressingCertification = await enableDistrictAddressingCertification(districtID, certificateType)
        if (!activationDistrictAddressingCertification) {
          handleAPIResponse(res, 404, 'Le district n\'a pas pu être activé pour la certification d\'adressage', {})
          return
        }
      }

      const action = {
        districtID,
        status: true,
        label: 'district-config-updated',
        siren,
        sessionID: req.sessionID
      }
      try {
        await addAction(action)
      } catch (error) {
        console.error('Failed to record action:', error)
      }

      const forceRepublicationUrl = `${NODE_ENV}` === 'production'
        ? `${API_IDFIX_URL}/compute-from-cog/${district?.meta?.insee?.cog}?force=true`
        : `http://host.docker.internal:3001/compute-from-cog/${district?.meta?.insee?.cog}?force=true`

      try {
        const responseRepublication = await fetch(forceRepublicationUrl, {
          method: 'GET',
          headers: {
            'content-Type': 'application/json',
            Authorization: `Token ${API_IDFIX_TOKEN}`,
          },
        })
        if (!responseRepublication.ok) {
          throw new Error(`Failed to force republication: ${responseRepublication.statusText}`)
        }
      } catch {
        await rollbackDistrictConfigOnRepublicationError(districtID, certificateType, config, oldConfig)
        handleAPIResponse(res, 500, 'Internal server error during republication', {})
        return
      }

      handleAPIResponse(res, 200, 'District config updated successfully', {})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  }
)

/**
 * @swagger
 * /api/district/authorized/cogs:
 *   get:
 *     summary: Récupérer les communes autorisées au partage d'identifiants (BETA - En phase de stabilisation des identifiants BAN)
 *     description: Liste tous les codes COG autorisées au partage d'identifiants
 *     tags:
 *       - 🏙️ Districts
 *     responses:
 *       200:
 *         description: Liste des COG autorisés
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
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Authorized COGs successfully retrieved"
 *                 response:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["75056", "69123", "13055"]
 *       500:
 *         description: Erreur serveur
 */
app.get('/authorized/cogs', analyticsMiddleware, async (req, res) => {
  try {
    const cogs = await getAllAuthorizedCogs()
    handleAPIResponse(res, 200, 'Authorized COGs successfully retrieved', cogs)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

/**
 * @swagger
 * /api/district/authorized/cogs/{cog}:
 *   get:
 *     summary: Vérifier si un COG est autorisé (BETA - En phase de stabilisation des identifiants BAN)
 *     description: Vérifie si un code COG spécifique est autorisé pour les updates inter-districts
 *     tags:
 *       - 🏙️ Districts
 *     parameters:
 *       - name: cog
 *         in: path
 *         required: true
 *         description: Code COG à vérifier
 *         schema:
 *           type: string
 *           example: "75056"
 *     responses:
 *       200:
 *         description: Statut du COG
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
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "COG status retrieved"
 *                 response:
 *                   type: object
 *                   properties:
 *                     cog:
 *                       type: string
 *                       example: "75056"
 *                     isAuthorized:
 *                       type: boolean
 *                       example: true
 *       500:
 *         description: Erreur serveur
 */
app.get('/authorized/cogs/:cog', analyticsMiddleware, async (req, res) => {
  try {
    const {cog} = req.params
    const authorized = await isAuthorizedCog(cog)
    handleAPIResponse(res, 200, 'COG status retrieved', {cog, isAuthorized: authorized})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

/**
 * @swagger
 * /api/district/authorized/cogs:
 *   post:
 *     summary: Ajouter les communes autorisées au partage d'identifiants (BETA - En phase de stabilisation des identifiants BAN)
 *     description: |
 *       Ajoute une liste de codes COG à la liste des autorisés.
 *       Les doublons dans la requête et les COGs déjà existants sont automatiquement gérés.
 *     tags:
 *       - 🏙️ Districts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *             example: ["75056", "69123", "13055"]
 *     responses:
 *       201:
 *         description: COGs traités avec succès
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
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "2 COG(s) successfully authorized, 1 already existed, 0 duplicates in request"
 *                 response:
 *                   type: object
 *                   properties:
 *                     insertedCount:
 *                       type: integer
 *                       example: 2
 *                       description: Nombre de COGs ajoutés
 *                     alreadyExist:
 *                       type: integer
 *                       example: 1
 *                       description: Nombre de COGs déjà existants
 *                     duplicatesInRequest:
 *                       type: integer
 *                       example: 0
 *                       description: Nombre de doublons dans la requête
 *       400:
 *         description: Format invalide
 *       500:
 *         description: Erreur serveur
 */
app.post('/authorized/cogs', auth, analyticsMiddleware, async (req, res) => {
  try {
    const cogs = req.body

    if (!Array.isArray(cogs) || cogs.length === 0) {
      handleAPIResponse(res, 400, 'Request body must be a non-empty array of COG strings', {})
      return
    }

    // Vérifier que ce sont bien des strings
    if (!cogs.every(cog => typeof cog === 'string')) {
      handleAPIResponse(res, 400, 'All COGs must be strings', {})
      return
    }

    const result = await addAuthorizedCogs(cogs)

    const message = `${result.insertedCount} COG(s) successfully authorized`
      + (result.alreadyExist > 0 ? `, ${result.alreadyExist} already existed` : '')
      + (result.duplicatesInRequest > 0 ? `, ${result.duplicatesInRequest} duplicates in request` : '')

    handleAPIResponse(res, 201, message, result)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

/**
 * @swagger
 * /api/district/authorized/cogs:
 *   delete:
 *     summary: Supprimer les communes autorisées au partage d'identifiants (BETA - En phase de stabilisation des identifiants BAN)
 *     description: |
 *       Retire une liste de codes COG de la liste des autorisés.
 *       Seuls les COGs existants sont supprimés. Les doublons et COGs inexistants sont ignorés.
 *     tags:
 *       - 🏙️ Districts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *             example: ["75056", "69123"]
 *     responses:
 *       200:
 *         description: COGs traités avec succès
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
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "2 COG(s) successfully removed, 1 not found, 0 duplicates in request"
 *                 response:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                       example: 2
 *                       description: Nombre de COGs supprimés
 *                     notFound:
 *                       type: integer
 *                       example: 1
 *                       description: Nombre de COGs introuvables
 *                     duplicatesInRequest:
 *                       type: integer
 *                       example: 0
 *                       description: Nombre de doublons dans la requête
 *       400:
 *         description: Format invalide
 *       500:
 *         description: Erreur serveur
 */
app.delete('/authorized/cogs', auth, analyticsMiddleware, async (req, res) => {
  try {
    const cogs = req.body

    if (!Array.isArray(cogs) || cogs.length === 0) {
      handleAPIResponse(res, 400, 'Request body must be a non-empty array of COG strings', {})
      return
    }

    if (!cogs.every(cog => typeof cog === 'string')) {
      handleAPIResponse(res, 400, 'All COGs must be strings', {})
      return
    }

    const result = await removeAuthorizedCogs(cogs)

    const message = `${result.deletedCount} COG(s) successfully removed`
      + (result.notFound > 0 ? `, ${result.notFound} not found` : '')
      + (result.duplicatesInRequest > 0 ? `, ${result.duplicatesInRequest} duplicates in request` : '')

    handleAPIResponse(res, 200, message, result)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
