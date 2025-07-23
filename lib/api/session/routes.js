import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import auth from '../../middleware/auth.js'
import {handleAPIResponse} from '../helper.js'
import {addSession} from './models.js'

const app = new express.Router()
app.use(express.json())

/**
 * @swagger
 * /api/session/:
 *   post:
 *     summary: Créer une nouvelle session
 *     description: |
 *       stock les sessions.
 *       Cette action requiert une authentification avec un jeton Bearer
 *     tags:
 *       - 📜 Sessions
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
 *                     sub:
 *                       type: string
 *                       example: "a950efd3-69e7-41df-b5d8-a47dc660b66e"
 *                     email:
 *                       type: string
 *                       example: "user@protonmail.com"
 *                     siret:
 *                       type: string
 *                       example: "123456712345"
 *                     aud:
 *                       type: string
 *                       example: "qziefozefjoijzfio"
 *                     exp:
 *                       type: string
 *                       example: "1234567"
 *                     iat:
 *                       type: string
 *                       example: "1234567"
 *                     iss:
 *                       type: string
 *                       example: "https://example.com"
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
    const {
      sub,
      email,
      siret,
      aud,
      exp,
      iat,
      iss,
    } = req.body

    if (!sub) {
      handleAPIResponse(res, 400, 'sub is required', {})
      return
    }

    if (!email) {
      handleAPIResponse(res, 400, 'email is required', {})
      return
    }

    if (!siret) {
      handleAPIResponse(res, 400, 'siret is required', {})
      return
    }

    if (!aud) {
      handleAPIResponse(res, 400, 'aud is required', {})
      return
    }

    if (!exp) {
      handleAPIResponse(res, 400, 'exp is required', {})
      return
    }

    if (!iat) {
      handleAPIResponse(res, 400, 'iat is required', {})
      return
    }

    if (!iss) {
      handleAPIResponse(res, 400, 'iss is required', {})
      return
    }

    const data = {...req.body}
    const session = await addSession(data)
    if (!session) {
      handleAPIResponse(res, 400, 'Session already exists', {})
      return
    }

    handleAPIResponse(res, 201, 'Session created', {})
  } catch (error) {
    console.error(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
