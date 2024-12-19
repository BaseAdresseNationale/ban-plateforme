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

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

/**
 * @swagger
 * tags:
 *   - name: common-toponym
 *     description: API for managing common toponyms
 */

/**
 * @swagger
 * /api/common-toponym/:
 *   post:
 *     summary: Add new common toponyms
 *     description: |
 *       Adds one or more new common toponyms by providing a list of objects.
 *       Each toponym must follow the structure defined in the schema **TYPE_json_ban_common_toponym**.
 *       See schema: [TYPE_json_ban_common_toponym](#/components/schemas/TYPE_json_ban_common_toponym)
 *     tags:
 *       - common-toponym
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
 *                   example: "Check the status of your request: ${BAN_API_URL}/job-status/${statusID}"
 *                 response:
 *                   type: object
 *                   properties:
 *                     statusID:
 *                       type: string
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

/**
 * @swagger
 * /api/common-toponym/:
 *   put:
 *     summary: Update existing common toponyms
 *     description: |
 *       Updates one or more common toponyms by providing their updated definitions.
 *       Each toponym must follow the structure defined in the schema **TYPE_json_ban_common_toponym**.
 *       See schema: [TYPE_json_ban_common_toponym](#/components/schemas/TYPE_json_ban_common_toponym)
 *     tags:
 *       - common-toponym
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
 *                   example: "Check the status of your request: ${BAN_API_URL}/job-status/${statusID}"
 *                 response:
 *                   type: object
 *                   properties:
 *                     statusID:
 *                       type: string
 */

/**
 * @swagger
 * /api/common-toponym/:
 *   patch:
 *     summary: Partially update common toponyms
 *     description: |
 *       Applies partial updates to existing common toponyms.
 *       Each toponym must follow the structure defined in the schema **TYPE_json_ban_common_toponym**.
 *       See schema: [TYPE_json_ban_common_toponym](#/components/schemas/TYPE_json_ban_common_toponym)
 *     tags:
 *       - common-toponym
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
 *                   example: "Check the status of your request: ${BAN_API_URL}/job-status/${statusID}"
 *                 response:
 *                   type: object
 *                     statusID:
 *                       type: string
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
      handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
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
      handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
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
      handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })


/**
 * @swagger
 * /api/common-toponym/{commonToponymID}:
 *   get:
 *     summary: Retrieve a common toponym by its identifier
 *     description: |
 *       Fetches a specific common toponym using its unique identifier (`commonToponymID`).
 *       If the toponym does not exist, a 404 error is returned.
 *     tags:
 *       - common-toponym
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
 *       - common-toponym
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
 *     summary: Bulk delete common toponyms
 *     description: Deletes multiple common toponyms by their IDs.
 *     tags:
 *       - common-toponym
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: string
 *     responses:
 *       200:
 *         description: Successfully deleted toponyms.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                 status:
 *                   type: string
 *                 response:
 *                   type: object
 *                   properties:
 *                     statusID:
 *                       type: string
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
    handleAPIResponse(res, 200, `Check the status of your request : ${BAN_API_URL}/job-status/${statusID}`, {statusID})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

/**
 * @swagger
 * /api/common-toponym/delta-report:
 *   post:
 *     summary: Generate delta report for common toponyms
 *     description: Creates a delta report based on provided data and district ID.
 *     tags:
 *       - common-toponym
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *               districtID:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully generated delta report.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 date:
 *                   type: string
 *                 status:
 *                   type: string
 *                 response:
 *                   type: object
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
