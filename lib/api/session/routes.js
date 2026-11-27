import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import express from 'express'
import lodash from 'lodash'
import auth from '../../middleware/auth.js'
import {handleAPIResponse} from '../helper.js'
import {addSession, createVerifiedSession, revokeSession} from './models.js'
import {BAN_SESSION_HEADER, isLegacySessionModeEnabled} from './config.js'
import {ProConnectVerificationError, verifyProConnectTokens} from './proconnect.js'

const app = new express.Router()
app.use(express.json())

const isNonEmptyString = value => typeof value === 'string' && value.length > 0

// Error messages only: a Sequelize error carries the query and its parameters (hash, personal data).
const logInternalError = error => {
  console.error(`Session route error: ${error.message}`)
}

const createSessionFromTokens = async ({req, res}) => {
  const {idToken, userinfo} = req.body
  if (!isNonEmptyString(idToken) || !isNonEmptyString(userinfo)) {
    handleAPIResponse(res, 400, 'idToken et userinfo requis', {})
    return
  }

  let identity
  try {
    identity = await verifyProConnectTokens({idToken, userinfo})
  } catch (error) {
    if (error instanceof ProConnectVerificationError) {
      handleAPIResponse(res, 401, 'Jetons ProConnect invalides', {})
      return
    }

    throw error
  }

  const {sessionId, expiresAt} = await createVerifiedSession(identity)
  handleAPIResponse(res, 201, 'Session created', {sessionId, expiresAt: expiresAt.toISOString()})
}

const LEGACY_REQUIRED_CLAIMS = ['sub', 'email', 'siret', 'aud', 'exp', 'iat', 'iss']
// Session columns the old mode may fill; the others (id, tokenHash, acr, amr) are set by the API only.
const LEGACY_CLAIM_FIELDS = [...LEGACY_REQUIRED_CLAIMS, 'name', 'givenName', 'familyName', 'usualName']

// Old mode, kept during the site transition: the claims are stored as sent, without verification.
const createLegacySession = async ({req, res}) => {
  const missingClaim = LEGACY_REQUIRED_CLAIMS.find(claim => !req.body[claim])
  if (missingClaim) {
    handleAPIResponse(res, 400, `${missingClaim} is required`, {})
    return
  }

  const created = await addSession(lodash.pick(req.body, LEGACY_CLAIM_FIELDS))
  if (!created) {
    handleAPIResponse(res, 200, 'Session already exists', {})
    return
  }

  handleAPIResponse(res, 201, 'Session created', {})
}

/**
 * @swagger
 * /api/session/:
 *   post:
 *     summary: Créer une session à partir des jetons ProConnect
 *     description: |
 *       Vérifie la signature, l'émetteur, l'audience et l'expiration du jeton d'identité (id_token) et de la
 *       réponse userinfo signée, avec les clés publiées par ProConnect, puis crée une session.
 *       L'identifiant de session renvoyé se passe ensuite dans l'en-tête `X-Ban-Session` des routes protégées.
 *       Chaque connexion crée une nouvelle session. Cette action requiert le jeton de service.
 *
 *       Ancien mode (transition) : un corps contenant les claims (`sub`, `email`, `siret`, `aud`, `exp`, `iat`, `iss`)
 *       au lieu des jetons n'est accepté que si l'API l'autorise explicitement ; il ne renvoie pas d'identifiant de session.
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
 *               - idToken
 *               - userinfo
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: id_token ProConnect brut (JWT signé).
 *               userinfo:
 *                 type: string
 *                 description: Réponse userinfo ProConnect brute, au format JWT signé.
 *     responses:
 *       201:
 *         description: Session créée.
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
 *                   example: "Session created"
 *                 response:
 *                   type: object
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                       description: Identifiant opaque de la session, à passer dans l'en-tête `X-Ban-Session`.
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: Fin de validité absolue de la session.
 *       200:
 *         description: Ancien mode uniquement, session déjà enregistrée.
 *       400:
 *         description: idToken ou userinfo manquant ou vide.
 *       401:
 *         description: Jeton de service invalide, ou jetons ProConnect refusés (signature, émetteur, audience, expiration, identité incohérente).
 *       500:
 *         description: Erreur interne du serveur, ou fournisseur ProConnect injoignable.
 *   delete:
 *     summary: Révoquer une session
 *     description: |
 *       Met fin à la session passée dans l'en-tête `X-Ban-Session`. Répond 204 même si la session est déjà
 *       révoquée, expirée ou inconnue. Cette action requiert le jeton de service.
 *     tags:
 *       - 📜 Sessions
 *     security:
 *       - bearerAuth: [] # Sécurisé avec un jeton Bearer
 *     parameters:
 *       - $ref: '#/components/parameters/BanSessionHeader'
 *     responses:
 *       204:
 *         description: Session révoquée (ou déjà inactive).
 *       400:
 *         description: En-tête X-Ban-Session manquant.
 *       401:
 *         description: Non autorisé (jeton de service requis).
 *       500:
 *         description: Erreur interne du serveur.
 */

app.post('/', auth, async (req, res) => {
  try {
    if (req.body.idToken !== undefined) {
      await createSessionFromTokens({req, res})
      return
    }

    if (!isLegacySessionModeEnabled()) {
      handleAPIResponse(res, 400, 'idToken et userinfo requis', {})
      return
    }

    await createLegacySession({req, res})
  } catch (error) {
    logInternalError(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

app.delete('/', auth, async (req, res) => {
  try {
    const sessionId = req.get(BAN_SESSION_HEADER)
    if (!sessionId) {
      handleAPIResponse(res, 400, `En-tête ${BAN_SESSION_HEADER} requis`, {})
      return
    }

    await revokeSession(sessionId)
    res.status(204).end()
  } catch (error) {
    logInternalError(error)
    handleAPIResponse(res, 500, 'Internal server error', {})
  }
})

export default app
