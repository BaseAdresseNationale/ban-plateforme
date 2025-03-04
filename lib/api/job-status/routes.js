import express from 'express'
import queue from '../../util/queue.cjs'
import {handleAPIResponse} from '../helper.js'
import {getJobStatus} from './models.js'

const apiQueue = queue('api')

const app = new express.Router()

/**
 * @swagger
 * /api/job-status/{statusID}:
 *   get:
 *     summary: Récupérer le statut d'un travail par ID
 *     description: |
 *       Retourne le statut d'un travail en file d'attente ou déjà traité, basé sur l'identifiant statusID.
 *       Le endpoint vérifie d'abord si le travail est dans la file d'attente (status: pending/processing),
 *       puis recherche dans la base de données des statuts terminés.
 *       La réponse contiendra des informations différentes selon:
 *       - Le type de données (dataType): address, commonToponym, district
 *       - Le type d'opération (jobType): insert, update, patch, delete
 *     tags:
 *       - 📊 Suivi, Statistiques & Recherche
 *     parameters:
 *       - in: path
 *         name: statusID
 *         required: true
 *         description: L'ID du statut du travail à vérifier.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statut du job récupéré avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   description: Date et heure de la réponse.
 *                   example: "2025-03-03T10:04:58.002Z"
 *                 status:
 *                   type: string
 *                   description: Statut de la réponse API (success/error).
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   description: Message de confirmation ou d'erreur.
 *                   example: "Job status has been processed"
 *                 response:
 *                   type: object
 *                   description: Détails du statut du job.
 *                   properties:
 *                     status:
 *                       type: string
 *                       description: Statut du job (success/error/pending/processing).
 *                       enum: [success, error, pending, processing]
 *                       example: "success"
 *                     dataType:
 *                       type: string
 *                       description: Type de données traitées.
 *                       enum: [address, commonToponym, district]
 *                       example: "address"
 *                     jobType:
 *                       type: string
 *                       description: Type d'opération effectuée.
 *                       enum: [insert, update, patch, delete]
 *                       example: "insert"
 *                     count:
 *                       type: integer
 *                       description: Nombre d'éléments traités.
 *                       example: 1
 *                     message:
 *                       type: string
 *                       nullable: true
 *                       description: Message d'erreur (null si succès).
 *                       example: null
 *                     report:
 *                       type: object
 *                       nullable: true
 *                       description: |
 *                         Rapport de validation détaillé en cas d'erreur.
 *                         Contient les résultats de validation selon le type de donnée:
 *                         - Pour address: résultats de checkAddressesRequest/checkAddressesIDsRequest
 *                         - Pour commonToponym: résultats de checkCommonToponymsRequest/checkCommonToponymsIDsRequest
 *                         - Pour district: résultats de checkDistrictsRequest/checkDistrictsIDsRequest
 *                       example: null
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Date de création du statut.
 *                       example: "2025-03-01T06:02:56.076Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Date de dernière mise à jour du statut.
 *                       example: "2025-03-01T06:02:56.076Z"
 *       200 (Job en attente):
 *         description: Statut d'un job qui n'a pas encore été traité.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-03-03T10:04:58.002Z"
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Job status has not been yet processed"
 *                 response:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [pending, processing]
 *                       example: "pending"
 *       400:
 *         description: Identifiant de statut manquant ou invalide.
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
 *                   example: "Request ID missing"
 *                 response:
 *                   type: object
 *                   description: Détails supplémentaires sur l'erreur.
 *       404:
 *         description: Statut du job non trouvé.
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
 *                   description: Détails supplémentaires sur l'erreur.
 *       500:
 *         description: Erreur interne du serveur lors du traitement de la requête.
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
 *                   description: Détails supplémentaires sur l'erreur.
 */
app.get('/:statusID', async (req, res) => {
  try {
    const {statusID} = req.params
    if (!statusID) {
      handleAPIResponse(res, 400, 'Request ID missing', {})
    }

    const job = await apiQueue.getJob(statusID)
    if (job) {
      const status = job?.processedOn ? 'processing' : 'pending'
      handleAPIResponse(res, 200, 'Job status has not been yet processed', {status})
    } else {
      const jobStatus = await getJobStatus(statusID)
      if (jobStatus) {
        const {id, ...jobStatusBody} = jobStatus
        if (jobStatusBody) {
          handleAPIResponse(res, 200, 'Job status has been processed', jobStatusBody)
        }
      } else {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
      }
    }
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
