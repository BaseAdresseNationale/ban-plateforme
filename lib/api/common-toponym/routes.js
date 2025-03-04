import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {handleAPIResponse} from '../helper.js'
import {getCommonToponym, deleteCommonToponym} from './models.js'
import {getDeltaReport, formatCommonToponym} from './utils.js'

const apiQueue = queue('api')

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

/**
 * @swagger
 * /api/common-toponym/:
 *   post:
 *     summary: Ajouter des nouveaux common toponyms
 *     description: |
 *       Ajoute un ou plusieurs nouveaux common toponyms en fournissant une liste d'objets..
 *       Chaque toponyme doit respecter la structure définie dans le schéma **TYPE_json_ban_common_toponym**.
 *     tags:
 *       - 📛 common-toponym
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TYPE_json_ban_common_toponym'
 *     responses:
 *       200:
 *         description: Toponyms successfully added. Use the returned ID to track the status.
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
 *                       example: CSMTD7C55
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
      const commonToponyms = req.body
      if (!Array.isArray(commonToponyms)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'commonToponym', jobType: 'insert', data: commonToponyms, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      handleAPIResponse(res, 200, 'Check the status of your request : https://plateforme.adresse.data.gouv.fr/api/job-status/CSMTD7C55', {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
  /**
 * @swagger
 * /api/common-toponym/:
 *   put:
 *     summary: Mise à jour des common toponyms
 *     description: |
 *       Met à jour un ou plusieurs common toponymsen fournissant leurs définitions mises à jour.
 *       Chaque toponym doit respecter la structure définie dans le schéma **TYPE_json_ban_common_toponym**.
 *     tags:
 *       - 📛 common-toponym
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TYPE_json_ban_common_toponym'
 *     responses:
 *       200:
 *         description: Toponyms successfully updated. Use the returned ID to track the status.
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
 *                   example: "Check the status of your request: https://plateforme.adresse.data.gouv.fr/api/job-status/CSMTD7C55"
 *                 response:
 *                   type: object
 *                   properties:
 *                     statusID:
 *                       type: string
 *                       exemple: "CSMTD7C55"
*/

  .put(auth, analyticsMiddleware, async (req, res) => {
    try {
      const commonToponyms = req.body
      if (!Array.isArray(commonToponyms)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'commonToponym', jobType: 'update', data: commonToponyms, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      handleAPIResponse(res, 200, 'Check the status of your request : https://plateforme.adresse.data.gouv.fr/api/job-status/CSMTD7C55', {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
/** * @swagger

 * /api/common-toponym/:
 *   patch:
 *     summary: Mise à jour partielle common toponyms
 *     description: |
 *       Applique des mises à jour partielles aux éléments existants common toponyms.
 *       Each toponym must follow the structure defined in the schema **TYPE_json_ban_common_toponym**.
 *     tags:
 *       - 📛 common-toponym
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TYPE_json_ban_common_toponym'
 *     responses:
 *       200:
 *         description: Toponyms successfully patched. Use the returned ID to track the status.
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
 *                   example: "Check the status of your request: https://plateforme.adresse.data.gouv.fr/api/job-status/CSMTD7C55"
 *                 response:
 *                   type: object
 *                   properties:
 *                     statusID:
 *                       type: string
 *                       exemple: "CSMTD7C55"
 *                       description: Unique identifier to track the request.
 */

  .patch(auth, analyticsMiddleware, async (req, res) => {
    try {
      const commonToponyms = req.body
      if (!Array.isArray(commonToponyms)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'commonToponym', jobType: 'patch', data: commonToponyms, statusID},
        {jobId: statusID, removeOnComplete: true}
      )
      handleAPIResponse(res, 200, 'Check the status of your request : https://plateforme.adresse.data.gouv.fr/api/job-status/CSMTD7C55', {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

/**
 * @swagger
 * /api/common-toponym/{commonToponymID}:
 *   get:
 *     summary: Récupérer un common toponym par son identifiant
 *     description: |
 *       Récupère un toponyme commun spécifique en utilisant son identifiant unique (commonToponymID).
 *       Si le toponyme n'existe pas, une erreur 404 est renvoyée.
 *     tags:
 *       - 📛 common-toponym
 *     parameters:
 *       - in: path
 *         name: commonToponymID
 *         required: true
 *         description: The unique identifier of the common toponym to retrieve.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The common toponym was successfully retrieved.
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
 *                   description: A message indicating the toponym was retrieved.
 *                   example: "Common toponym successfully retrieved"
 *                 response:
 *                    $ref: '#/components/schemas/TYPE_json_ban_common_toponym'
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
 *         description: The toponym with the specified identifier was not found.
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
 *                   description: A message indicating the toponym was not found.
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
 *   delete:
 *     summary: Delete an existing common toponym
 *     description: |
 *       Deletes an existing common toponym by providing its identifier.
 *       The toponym must exist for the deletion to occur.
 *     tags:
 *       - 📛 common-toponym
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commonToponymID
 *         required: true
 *         description: The unique identifier of the common toponym to delete.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The common toponym was successfully deleted.
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
 *                   description: A message confirming the deletion of the toponym.
 *                   example: "Common toponym successfully deleted"
 *                 response:
 *                   type: object
 *                   description: An empty object or additional information about the deletion.
 *       404:
 *         description: The specified toponym was not found.
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
 *                   description: A message indicating the toponym was not found.
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
app.route('/:commonToponymID')
  .get(analyticsMiddleware, async (req, res) => {
    try {
      const {commonToponymID} = req.params
      if (!commonToponymID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const commonToponym = await getCommonToponym(commonToponymID)
      if (!commonToponym) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      const commonToponymFormatted = formatCommonToponym(commonToponym)
      handleAPIResponse(res, 200, 'Common toponym successfully retrieved', commonToponymFormatted)
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
  .delete(auth, analyticsMiddleware, async (req, res) => {
    try {
      const {commonToponymID} = req.params
      if (!commonToponymID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const commonToponym = await getCommonToponym(commonToponymID)
      if (!commonToponym) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      await deleteCommonToponym(commonToponymID)
      handleAPIResponse(res, 200, 'Common toponym successfully deleted', {})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

/**
 * @swagger
 * /api/common-toponym/delete:
 *   post:
 *     summary: Supprimer plusieurs toponymes communs
 *     description: |
 *       Supprime plusieurs toponymes communs en envoyant une liste d'identifiants.
 *       Chaque identifiant dans la liste doit correspondre à un toponyme existant.
 *     tags:
 *       - 📛 common-toponym
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TYPE_ban_id_common_toponym'
 *     responses:
 *       200:
 *         description: La suppression des toponymes communs a été initiée avec succès. L'utilisateur peut suivre l'état de la demande via un identifiant unique.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   description: Date de la réponse.
 *                 status:
 *                   type: string
 *                   description: Le statut de la réponse, qui sera "success" pour une réussite.
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: Message indiquant l'URL pour suivre l'état de la demande, incluant le `statusID`.
 *                   example: "Check the status of your request: https://plateforme.adresse.data.gouv.fr/api/job-status/CSMTD7C55"
 *                 response:
 *                   type: object
 *                   properties:
 *                     statusID:
 *                       type: string
 *                       exemple: "CSMTD7C55"
 *                       description: Identifiant unique généré pour suivre l'état de la demande.
 *       400:
 *         description: La requête est invalide. L'input n'est pas correctement formaté ou des données sont manquantes.
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
 *                   description: Le statut de la réponse, qui sera "error" en cas d'erreur.
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   description: Message indiquant l'erreur de la requête.
 *                   example: "Wrong request format"
 *                 response:
 *                   type: object
 *                   description: Objet vide ou contenant des informations supplémentaires concernant l'erreur.
 *       500:
 *         description: Erreur interne du serveur. Un problème est survenu lors du traitement de la requête.
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
 *                   description: Le statut de la réponse, qui sera "error" en cas d'erreur interne.
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   description: Message détaillant l'erreur interne du serveur.
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 *                   description: Objet vide ou contenant des informations supplémentaires sur l'erreur.
 */

app.post('/delete', auth, analyticsMiddleware, async (req, res) => {
  try {
    const commonToponymIDs = req.body
    if (!Array.isArray(commonToponymIDs)) {
      handleAPIResponse(res, 400, 'Wrong request format', {})
      return
    }

    const statusID = nanoid()
    await apiQueue.add(
      {dataType: 'commonToponym', jobType: 'delete', data: commonToponymIDs, statusID},
      {jobId: statusID, removeOnComplete: true}
    )
    handleAPIResponse(res, 200, 'Check the status of your request : https://plateforme.adresse.data.gouv.fr/api/job-status/CSMTD7C55', {statusID})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

/**
 * @swagger
 * /api/common-toponym/delta-report:
 *   post:
 *     summary: Générer un rapport delta pour les toponymes communs
 *     description: |
 *       Cet endpoint permet de générer un rapport delta qui contient les toponymes communs à créer, mettre à jour ou supprimer,
 *       en fonction de la comparaison entre les données envoyées et celles déjà présentes dans la base de données.
 *       Les toponymes sont envoyés sous forme de tableau d'identifiants, et le rapport est basé sur un `districtID` spécifique.
 *     tags:
 *       - 📛 common-toponym
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/TYPE_ban_id_common_toponym'
 *                 description: Liste des identifiants de toponymes communs avec hash.
 *               districtID:
 *                 $ref : '#/components/schemas/TYPE_ban_id_district'
 *     responses:
 *       200:
 *         description: Le rapport delta a été généré avec succès. Il contient les toponymes communs à créer, mettre à jour ou supprimer.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   description: Date de la réponse.
 *                 status:
 *                   type: string
 *                   description: Le statut de la réponse, qui sera "success" pour une réussite.
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: Message indiquant que le rapport a été généré avec succès.
 *                   example: "Delta report successfully generated"
 *                 response:
 *                   type: object
 *                   properties:
 *                     idsToCreate:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TYPE_ban_id_common_toponym'
 *                       description: Liste des identifiants de toponymes communs à créer.
 *                     idsToUpdate:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TYPE_ban_id_common_toponym'
 *                       description: Liste des identifiants de toponymes communs à mettre à jour.
 *                     idsToDelete:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TYPE_ban_id_common_toponym'
 *                       description: Liste des identifiants de toponymes communs à supprimer.
 *                     idsUnauthorized:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TYPE_ban_id_common_toponym'
 *                       description: Liste des identifiants de toponymes communs non autorisés.
 *       400:
 *         description: La requête est invalide. Les données ou `districtID` sont manquants ou mal formatés.
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
 *                   description: Le statut de la réponse, qui sera "error" en cas d'erreur.
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   description: Message indiquant l'erreur de la requête.
 *                   example: "Wrong request format"
 *       500:
 *         description: Erreur interne du serveur. Un problème est survenu lors du traitement de la requête.
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
 *                   description: Le statut de la réponse, qui sera "error" en cas d'erreur interne.
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   description: Message détaillant l'erreur interne du serveur.
 *                   example: "Internal server error"
 *                 response:
 *                   type: object
 *                   description: Objet vide ou contenant des informations supplémentaires sur l'erreur.
 */

app.post('/delta-report', auth, analyticsMiddleware, async (req, res) => {
  try {
    const {data, districtID} = req.body

    if (!data || !districtID) {
      handleAPIResponse(res, 400, 'Wrong request format', {})
      return
    }

    const deltaReport = await getDeltaReport(data, districtID)
    handleAPIResponse(res, 200, 'Delta report generated', deltaReport)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
