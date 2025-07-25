import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {handleAPIResponse} from '../helper.js'
import {getCommonToponymsCountByDistrict} from '../common-toponym/models.js'
import {getAddressesCountByDistrict} from '../address/models.js'
import {getDistrict, getDistrictsFromCog, deleteDistrict} from './models.js'
import {formatDistrict} from './utils.js'

const apiQueue = queue('api')

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

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

export default app
