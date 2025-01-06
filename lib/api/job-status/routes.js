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
 *       Retourne le statut d'un travail en file d'attente ou déjà traité, basé sur l'identifiant `statusID`.
 *     tags:
 *       - job-status
 *     parameters:
 *       - in: path
 *         name: statusID
 *         required: true
 *         description: L'ID du statut du travail à vérifier.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job status retrieved successfully.
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
 *                   example: "Job status has been processed"
 *                 response:
 *                   type: object
 *                   additionalProperties: true
 *                   description: The job status details.
 *       400:
 *         description: Missing or invalid `statusID`.
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
 *                   description: Additional error details.
 *       404:
 *         description: Job status not found.
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
