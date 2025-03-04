import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {customAlphabet} from 'nanoid'
import express from 'express'
import queue from '../../util/queue.cjs'
import auth from '../../middleware/auth.js'
import analyticsMiddleware from '../../middleware/analytics.js'
import {handleAPIResponse} from '../helper.js'
import {getAddress, deleteAddress} from './models.js'
import {getDeltaReport, formatAddress} from './utils.js'

const apiQueue = queue('api')

const nanoid = customAlphabet('123456789ABCDEFGHJKMNPQRSTVWXYZ', 9)

const app = new express.Router()

const BAN_API_URL
  = process.env.BAN_API_URL || 'https://plateforme.adresse.data.gouv.fr/api'

/**
 * @swagger
 * /api/address/:
 *   post:
 *     summary: Créer de nouvelles adresses
 *     description: |
 *       Crée une ou plusieurs nouvelles adresses en envoyant une liste d'objets adresse.
 *       Chaque adresse doit respecter la structure décrite dans le schéma **TYPE_json_ban_address**.
 *       Voir le schéma : [TYPE_json_ban_address](#/components/schemas/TYPE_json_ban_address)
 *     tags:
 *       - 📍 Adresses
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TYPE_json_ban_address'
 *     responses:
 *       200:
 *         description: La création des tâches pour les adresses a été initiée avec succès. L'utilisateur peut suivre l'état de la demande via un identifiant unique.
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
app.route('/')
  .post(auth, analyticsMiddleware, async (req, res) => {
    try {
      const addresses = req.body
      if (!Array.isArray(addresses)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'address', jobType: 'insert', data: addresses, statusID},
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
 * /api/address/:
 *   put:
 *     summary: Mettre à jour des adresses existantes
 *     description: |
 *       Met à jour une ou plusieurs adresses en envoyant une liste d'objets adresse.
 *       Chaque adresse doit respecter la structure décrite dans le schéma **TYPE_json_ban_address**.
 *       Voir le schéma : [TYPE_json_ban_address](#/components/schemas/TYPE_json_ban_address)
 *     tags:
 *       - 📍 Adresses
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TYPE_json_ban_address'
 *     responses:
 *       200:
 *         description: La mise à jour des adresses a+ été initiée avec succès. L'utilisateur peut suivre l'état de la demande via un identifiant unique.
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

  .put(auth, analyticsMiddleware, async (req, res) => {
    try {
      const addresses = req.body
      if (!Array.isArray(addresses)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'address', jobType: 'update', data: addresses, statusID},
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
 * /api/address/:
 *   patch:
 *     summary: Modifier partiellement des adresses existantes
 *     description: |
 *       Modifie partiellement une ou plusieurs adresses en envoyant une liste d'objets adresse.
 *       Chaque adresse doit respecter la structure décrite dans le schéma **TYPE_json_ban_address**.
 *       Voir le schéma : [TYPE_json_ban_address](#/components/schemas/TYPE_json_ban_address)
 *     tags:
 *       - 📍 Adresses
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TYPE_json_ban_address'
 *     responses:
 *       200:
 *         description: La modification partielle des adresses a été initiée avec succès. L'utilisateur peut suivre l'état de la demande via un identifiant unique.
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

  .patch(auth, analyticsMiddleware, async (req, res) => {
    try {
      const addresses = req.body
      if (!Array.isArray(addresses)) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const statusID = nanoid()
      await apiQueue.add(
        {dataType: 'address', jobType: 'patch', data: addresses, statusID},
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
 * /api/address/{addressID}:
 *   get:
 *     summary: Récupérer une adresse par son identifiant
 *     description: |
 *       Récupère une adresse spécifique en utilisant son identifiant unique (`addressID`).
 *       Si l'adresse n'existe pas, une erreur 404 est renvoyée.
 *     tags:
 *       - 📍 Adresses
 *     parameters:
 *       - in: path
 *         name: addressID
 *         required: true
 *         description: L'identifiant unique de l'adresse à récupérer.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: L'adresse a été récupérée avec succès.
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
 *                   description: Message indiquant que l'adresse a été récupérée avec succès.
 *                   example: "Address successfully retrieved"
 *                 response:
 *                    $ref: '#/components/schemas/TYPE_json_ban_address'
 *       400:
 *         description: La requête est invalide. L'identifiant d'adresse est manquant ou incorrect.
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
 *                   description: Message indiquant que l'identifiant d'adresse est manquant ou incorrect.
 *                   example: "Wrong request format"
 *                 response:
 *                   type: object
 *                   description: Objet vide ou contenant des informations supplémentaires concernant l'erreur.
 *       404:
 *         description: L'adresse avec l'identifiant spécifié n'a pas été trouvée.
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
 *                   description: Message indiquant que l'adresse n'a pas été trouvée.
 *                   example: "Request ID unknown"
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

app.route('/:addressID')
  .get(analyticsMiddleware, async (req, res) => {
    try {
      const {addressID} = req.params
      if (!addressID) {
        handleAPIResponse(res, 400, 'Wrong request format', {})
        return
      }

      const address = await getAddress(addressID)
      if (!address) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      const addressFormatted = formatAddress(address)
      handleAPIResponse(res, 200, 'Address successfully retrieved', addressFormatted)
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

/**
 * @swagger
 * /api/address/{addressID}:
 *   delete:
 *     summary: Supprimer une adresse existante
 *     description: |
 *       Supprime une adresse existante en fournissant l'identifiant de l'adresse.
 *       L'adresse doit exister pour que la suppression soit effectuée.
 *     tags:
 *       - 📍 Adresses
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressID
 *         required: true
 *         description: L'identifiant unique de l'adresse à supprimer.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: L'adresse a été supprimée avec succès.
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
 *                   description: Message confirmant la suppression de l'adresse.
 *                   example: "Address successfully deleted"
 *                 response:
 *                   type: object
 *                   description: Objet vide ou contenant des informations supplémentaires sur la suppression.
 *       404:
 *         description: L'adresse spécifiée n'a pas été trouvée.
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
 *                   description: Message indiquant que l'adresse n'a pas été trouvée.
 *                   example: "Request ID unknown"
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

  .delete(auth, analyticsMiddleware, async (req, res) => {
    try {
      const {addressID} = req.params
      const address = await getAddress(addressID)

      if (!address) {
        handleAPIResponse(res, 404, 'Request ID unknown', {})
        return
      }

      await deleteAddress(addressID)
      handleAPIResponse(res, 200, 'Address successfully deleted', {})
    } catch (error) {
      console.error(error)
      handleAPIResponse(res, 500, 'Internal server error', {})
    }
  })

/**
 * @swagger
 * /api/address/delete:
 *   post:
 *     summary: Supprimer plusieurs adresses
 *     description: |
 *       Supprime plusieurs adresses en envoyant une liste d'identifiants d'adresses.
 *       Chaque identifiant d'adresse dans la liste doit correspondre à une adresse existante.
 *     tags:
 *       - 📍 Adresses
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               $ref: '#/components/schemas/TYPE_ban_id_address'
 *     responses:
 *       200:
 *         description: La suppression des adresses a été initiée avec succès. L'utilisateur peut suivre l'état de la demande via un identifiant unique.
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
    const addressIDs = req.body
    if (!Array.isArray(addressIDs)) {
      handleAPIResponse(res, 400, 'Wrong request format', {})
      return
    }

    const statusID = nanoid()

    await apiQueue.add(
      {dataType: 'address', jobType: 'delete', data: addressIDs, statusID},
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
 * /api/delta-report:
 *   post:
 *     summary: Générer un rapport delta pour les adresses
 *     description: |
 *       Cet endpoint permet de générer un rapport delta qui contient les adresses à créer, mettre à jour ou supprimer, en fonction de la comparaison entre les adresses envoyées et celles déjà présentes dans la base de données.
 *       Les adresses sont envoyées sous forme de tableau d'identifiants, et le rapport est basé sur un `districtID` spécifique.
 *     tags:
 *       - 📍 Adresses
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
 *                   $ref: '#/components/schemas/TYPE_ban_id_address'
 *                 description: Liste des identifiants d'adresses avec hash.
 *               districtID:
 *                   $ref : '#/components/schemas/TYPE_ban_id_district'
 *     responses:
 *       200:
 *         description: Le rapport delta a été généré avec succès. Le rapport contient les adresses à créer, mettre à jour, ou supprimer.
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
 *                         $ref: '#/components/schemas/TYPE_ban_id_address'
 *                       description: Liste des identifiants d'adresses à créer.
 *                     idsToUpdate:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TYPE_ban_id_address'
 *                       description: Liste des identifiants d'adresses à mettre à jour.
 *                     idsToDelete:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TYPE_ban_id_address'
 *                       description: Liste des identifiants d'adresses à supprimer.
 *                     idsUnauthorized:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TYPE_ban_id_address'
 *                       description: Liste des identifiants d'adresses non autorisées.
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
    handleAPIResponse(res, 200, 'Delta report successfully generated', deltaReport)
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
