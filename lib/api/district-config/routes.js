import express from 'express'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {handleAPIResponse, checkDataShema} from '../helper.js'
import {District} from '../../util/sequelize.js'
import {configSchema} from '../district/schema.js'
import {getDistrictConfigJson, upsertDistrictConfigMerge} from './models.js'

const app = new express.Router()

/**
 * @swagger
 * /api/district-config/{districtId}:
 *   get:
 *     summary: Lire la config JSON d’un district
 *     tags:
 *       - ⚙️ Configuration district
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: districtId
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/TYPE_ban_id_district'
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/TYPE_api_response'
 *                 - type: object
 *                   properties:
 *                     response:
 *                       $ref: '#/components/schemas/TYPE_ban_district_config_api_response'
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: District inconnu
 *       500:
 *         description: Erreur serveur
 *   patch:
 *     summary: Mettre à jour la config (merge partiel)
 *     tags:
 *       - ⚙️ Configuration district
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: districtId
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/TYPE_ban_id_district'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TYPE_json_ban_district_config_patch'
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/TYPE_api_response'
 *                 - type: object
 *                   properties:
 *                     response:
 *                       $ref: '#/components/schemas/TYPE_ban_district_config_api_response'
 *       400:
 *         description: Corps invalide
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: District inconnu
 *       500:
 *         description: Erreur serveur
 */
app.route('/:districtId')
  .get(auth, analyticsMiddleware, async (req, res) => {
    try {
      const {districtId} = req.params
      const district = await District.findByPk(districtId)
      if (!district) {
        handleAPIResponse(res, 404, 'District not found', {})
        return
      }

      const config = await getDistrictConfigJson(districtId)
      handleAPIResponse(res, 200, 'District config retrieved', {districtId, config})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })
  .patch(auth, analyticsMiddleware, async (req, res) => {
    try {
      const {districtId} = req.params
      const district = await District.findByPk(districtId)
      if (!district) {
        handleAPIResponse(res, 404, 'District not found', {})
        return
      }

      const validation = await checkDataShema('Invalid config format', [req.body], configSchema, {isPatch: true})
      if (validation) {
        handleAPIResponse(res, 400, validation.report.message, validation.report.data)
        return
      }

      await upsertDistrictConfigMerge(districtId, req.body)
      const config = await getDistrictConfigJson(districtId)
      handleAPIResponse(res, 200, 'District config updated', {districtId, config})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

export default app
