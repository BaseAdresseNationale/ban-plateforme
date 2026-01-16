const fs = require('node:fs')
const express = require('express')
const Papa = require('papaparse')
const {snakeCase, mapKeys} = require('lodash')
const fetch = require('../util/fetch.cjs')
const currentDate = require('../util/local-current-date.cjs')
const {computeFilteredStats} = require('../models/ban.cjs')
const {
  getCommune,
  getCommuneData,
  getPopulatedVoie,
  getPopulatedNumero,
  getPopulatedCommune,
  getAdressesFeatures,
  getToponymesFeatures,
  getCommunesSummary,
} = require('../models/commune.cjs')
const Metric = require('../models/metric.cjs')
const {
  prepareAdresses: prepareAdressesLegacy,
  prepareLieuxDits,
} = require('../formatters/csv-legacy.cjs')
const {
  prepareAdresses: prepareAdressesBal,
  extractHeaders,
} = require('../formatters/csv-bal.cjs')
const w = require('../util/w.cjs')
const serveMvt = require('../util/serve-mvt.cjs')
const Commune = require('../models/commune.cjs')

const {
  ADMIN_TOKEN = '',
  API_IDFIX_URL = 'https://plateforme.adresse.data.gouv.fr/api-idfix',
  API_IDFIX_TOKEN = '',
  BAN_API_URL = '',
} = process.env

const prepareMethode = {
  'csv-legacy': {
    adresses: prepareAdressesLegacy,
    'lieux-dits': prepareLieuxDits,
  },
  'csv-bal': {
    adresses: prepareAdressesBal,
  },
}

const getLegacyTypeFromId = id => {
  switch (id.length) {
    case 5:
      return 'Commune'
    case 10:
    case 12:
      return 'Voie'
    default:
      return id.length >= 16 && 'Numéro'
  }
}

const sendToTracker = async ({url: paramUrl, download: paramDownload, ...params} = {}, ...args) => {
  const module = await import('../util/analytics-tracker.js')
  if (!module.sendToTracker) {
    console.warn('Legacy-routes: sendToTracker not found')
    return
  }

  const url = paramUrl && `${BAN_API_URL}${paramUrl}`
  const download = paramDownload && `${BAN_API_URL}${paramDownload}`

  return module.sendToTracker(
    {
      ...(url ? {url} : {}),
      ...(download ? {download} : {}),
      ...params
    },
    ...args)
}

const trackEventDefault = {
  category: 'API Legacy',
  value: 1,
}

const analyticsMiddleware = {
  authError(req, res, next) {
    const {url} = req
    const trackEvent = {
      ...trackEventDefault,
      action: 'Error',
      name: 'Erreur d’authentification',
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  codeCommuneError(req, res, next) {
    const {url} = req
    const trackEvent = {
      ...trackEventDefault,
      action: 'Error',
      name: 'Code commune inconnu',
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  composeCommune(req, res, next) {
    const {url} = req
    const {codeCommune} = req.commune
    const trackEvent = {
      ...trackEventDefault,
      action: 'Compose commune',
      name: codeCommune,
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  communesSummary(req, res, next) {
    const {url} = req
    const trackEvent = {
      ...trackEventDefault,
      action: 'Communes Summary',
      name: 'Display',
      value: 1,
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  exportCommunesSummary(req, res, next) {
    const {url} = req
    const trackEvent = {
      ...trackEventDefault,
      action: 'Communes Summary',
      name: 'Export to CSV',
      value: 1,
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  lookup(req, res, next) {
    const {url} = req
    const {id} = req.params
    const typeLookup = getLegacyTypeFromId(id)
    const trackEvent = {
      ...trackEventDefault,
      action: 'Lookup',
      name: typeLookup,
      value: 1,
    }
    sendToTracker({url, trackEvent})
    next?.()
  },
  downloadCommuneData(req, res, next) {
    const {url, commune = {}} = req
    const {codeCommune, downloadFormat, downloadType} = req.params
    const nomCommune = commune?.nomCommune
    const trackEvent = {
      category: 'Download',
      action: `Download Commune ${downloadType} (Format ${downloadFormat})`,
      name: `${codeCommune}${nomCommune ? ` - ${nomCommune}` : ''}`,
      value: 1,
    }
    sendToTracker({url, trackEvent})
    next?.()
  },

}

const ensureIsAdmin = (req, res, next) => {
  if (!ADMIN_TOKEN) {
    return res.status(401).send({
      code: 401,
      message: 'Aucun jeton d’administration n’a été défini',
    })
  }

  if (req.get('Authorization') !== `Token ${ADMIN_TOKEN}`) {
    analyticsMiddleware.authError(req, res)
    return res.status(401).send({
      code: 401,
      message: 'Vous n’êtes pas autorisé à effectuer cette action',
    })
  }

  next()
}

const app = express.Router()

app.param(
  'codeCommune',
  w(async (req, res, next) => {
    const {codeCommune} = req.params
    const commune = await getCommune(codeCommune)

    if (!commune) {
      analyticsMiddleware.codeCommuneError(req, res)
      return res
        .status(404)
        .send({code: 404, message: 'Commune non présente dans la BAN'})
    }

    req.commune = commune
    next()
  })
)

const acceptedBalVersion = new Set(['1.3', '1.4'])

/**
 * @swagger
 * /ban/communes/{codeCommune}/download/{downloadFormat}/{downloadType}:
 *   get:
 *     summary: Télécharger les données d'une commune
 *     description: |
 *       Permet de télécharger les données d'une commune au format CSV.
 *     tags:
 *       - 🏘️ Communes & Composition d’adresses
 *     parameters:
 *       - name: codeCommune
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9]{5}$"
 *           example: "75056"
 *         description: |
 *           Code INSEE à 5 chiffres de la commune concernée.
 *       - name: downloadFormat
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: ["csv-bal", "csv-legacy"]
 *         description: |
 *           Format du fichier à télécharger.
 *           - `csv-bal` : Format Base Adresse Locale (versions `1.3` et `1.4`).
 *           - `csv-legacy` : Format historique.
 *       - name: downloadType
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: ["adresses", "lieux-dits", "numeros", "voies"]
 *         description: |
 *           Type de données à inclure dans le fichier :
 *           - `adresses` : Toutes les adresses.
 *           - `lieux-dits` : Lieux-dits uniquement.
 *           - `numeros` : Numéros de voie.
 *           - `voies` : Voies de la commune.
 *       - name: version
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           default: "1.3"
 *           enum: ["1.3", "1.4"]
 *         description: |
 *           Version du format BAL (`1.3` ou `1.4`), uniquement applicable si `downloadFormat=csv-bal`.
 *     responses:
 *       200:
 *         description: Fichier CSV généré avec succès.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Requête invalide (paramètre incorrect).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "Format de téléchargement invalide."
 *       404:
 *         description: Données non trouvées ou version non disponible.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "La version demandée n’est pas disponible."
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "Erreur interne du serveur lors du téléchargement."
 */

// API Download Commune Data
app.get(
  '/ban/communes/:codeCommune/download/:downloadFormat/:downloadType',
  analyticsMiddleware.downloadCommuneData,
  w(async (req, res) => {
    const {codeCommune, downloadFormat, downloadType} = req.params
    const {version = '1.3'} = req.query
    const isCsvBal = downloadFormat === 'csv-bal'
    if (isCsvBal && version && !acceptedBalVersion.has(version)) {
      return res.status(404).send({
        code: 404,
        message: 'La version demandée n’est pas disponible',
      })
    }

    const {voies, numeros} = await getCommuneData(codeCommune)
    const data = prepareMethode
      ?.[downloadFormat]
      ?.[downloadType]?.({voies, numeros}, {includesAlt: true, version}) || null
    const headers = isCsvBal
      ? {
        header: true,
        columns: extractHeaders(data),
      } : {}

    const csvFile = Papa.unparse(data, {delimiter: ';', ...headers})

    const fileResponseName = `${downloadType}-${codeCommune}.csv`
    res
      .attachment(fileResponseName)
      .type('text/csv')
      .send(csvFile)
  })
)
/**
 * @swagger
 * /ban/communes/{codeCommune}/compose:
 *   post:
 *     summary: Générer la composition d'une commune via ID-Fix
 *     description: |
 *       Cette route déclenche le calcul de la composition d'une commune spécifique en appelant l'API ID-Fix.
 *       Elle retourne les détails de la commune et de son adressage après traitement.
 *     tags:
 *       - 🏘️ Communes & Composition d’adresses
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: codeCommune
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           pattern: "^[0-9]{5}$"
 *           example: "32184"
 *         description: |
 *           Code INSEE de la commune à analyser.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 description: |
 *                   Si activé, force la mise à jour des données même si elles existent déjà.
 *                 example: true
 *               force_seuil:
 *                 type: boolean
 *                 description: |
 *                   Si activé, force le recalcul même si le seuil de mise à jour n'est pas atteint.
 *                 example: false
 *     responses:
 *       200:
 *         description: Composition générée avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 codeCommune:
 *                   type: string
 *                   example: "32184"
 *                 nomCommune:
 *                   type: string
 *                   example: "Lalanne"
 *                 departement:
 *                   type: object
 *                   properties:
 *                     nom:
 *                       type: string
 *                       example: "Gers"
 *                     code:
 *                       type: string
 *                       example: "32"
 *                 region:
 *                   type: object
 *                   properties:
 *                     nom:
 *                       type: string
 *                       example: "Occitanie"
 *                     code:
 *                       type: string
 *                       example: "76"
 *                 nbVoies:
 *                   type: integer
 *                   example: 16
 *                 nbNumeros:
 *                   type: integer
 *                   example: 62
 *                 nbNumerosCertifies:
 *                   type: integer
 *                   example: 62
 *                 codesPostaux:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["32500"]
 *       400:
 *         description: Requête invalide
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: "Le code commune fourni est invalide."
 *       401:
 *         description: Authentification requise ou jeton invalide.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 401
 *                 message:
 *                   type: string
 *                   example: "Accès non autorisé. Jeton d'authentification manquant ou invalide."
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "Erreur interne du serveur. Impossible de récupérer la composition de la commune."
 */

// API-Legacy
app.post(
  '/ban/communes/:codeCommune/compose',
  ensureIsAdmin,
  w(async (req, res) => {
    const {codeCommune} = req.commune
    const {force, force_seuil: forceSeuil} = req.body
    try {
      // Construction des paramètres de requête
      const queryParams = []
      if (force !== undefined) {
        queryParams.push(`force=${force}`)
      }

      if (forceSeuil !== undefined) {
        queryParams.push(`force_seuil=${forceSeuil}`)
      }

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : ''

      // Async Call to ID-Fix
      fetch(`${API_IDFIX_URL}/compute-from-cog/${codeCommune}${queryString}`, {
        method: 'GET',
        headers: {
          'content-Type': 'application/json',
          Authorization: `Token ${API_IDFIX_TOKEN}`,
        },
      })
        .then(response => response.json())
        .then(idFixResponse => {
          console.log(idFixResponse)
        })
        .catch(error => {
          console.log(`[${currentDate()}][ERROR]`, error)
        })

      const commune = await getCommune(codeCommune)
      return res.send(commune)
    } catch (error) {
      const errMsg = `--- ${new Date().toUTCString()} codeCommune : ${codeCommune} erreur : ${error} --- `.replace(/^(\s)*/gm, '')
      fs.appendFile('errorCompose.log', errMsg, error => {
        if (error) {
          throw error
        }
      })
      return res.sendStatus(500)
    }
  })
)

/**
 * @swagger
 * /api/legacy-compose/{codeCommune}/:
 *   post:
 *     summary: Demander la composition legacy pour une commune
 *     description: Envoie une requête de composition legacy pour une commune spécifique. Requiert les permissions administratives.
 *     security:
 *       - BearerAuth: []
 *     tags:
 *       - 🏘️ Communes & Composition d’adresses
 *     parameters:
 *       - name: codeCommune
 *         in: path
 *         required: true
 *         description: Code INSEE de la commune pour laquelle demander la composition legacy.
 *         schema:
 *           type: string
 *           example: "75056"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 description: Indique si la composition doit être forcée.
 *                 example: true
 *               ignoreIdConfig:
 *                 type: boolean
 *                 description: Indique si la configuration d'identifiant doit être ignorée.
 *                 example: false
 *     responses:
 *       200:
 *         description: Requête de composition legacy envoyée avec succès.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Legacy compose asked for cog: 75056"
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */

app.post(
  '/api/legacy-compose/:codeCommune/',
  ensureIsAdmin,
  analyticsMiddleware.composeCommune,
  w(async (req, res) => {
    const {codeCommune} = req.commune
    const {force, ignoreIdConfig} = req.body

    try {
      // Async Call to ID-Fix
      await Commune.askComposition(codeCommune, {force}, ignoreIdConfig)
      return res.send(`Legacy compose asked for cog: ${codeCommune}`)
    } catch (error) {
      const errMsg = `---
      ${new Date().toUTCString()}
      codeCommune : ${codeCommune}
      erreur : ${error}
      ---
      `.replace(/^(\s)*/gm, '')
      fs.appendFile('errorCompose.log', errMsg, error => {
        if (error) {
          throw error
        }
      })
      return res.sendStatus(500)
    }
  })
)

/**
 * @swagger
 * /api/communes-summary:
 *   get:
 *     summary: Obtenir un résumé des communes
 *     description: Récupère un résumé des données des communes.
 *     tags:
 *       - 🏘️ Communes & Composition d’adresses
 *     responses:
 *       200:
 *         description: Résumé des communes récupéré avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   codeCommune:
 *                     type: string
 *                     description: Code INSEE de la commune.
 *                     example: "01001"
 *                   name:
 *                     type: string
 *                     description: Nom de la commune.
 *                     example: "L'Abergement-Clémenciat"
 *                   population:
 *                     type: integer
 *                     description: Population de la commune.
 *                     example: 832
 *                   departement:
 *                     type: string
 *                     description: Code du département de la commune.
 *                     example: "01"
 *                   region:
 *                     type: string
 *                     description: Code de la région de la commune.
 *                     example: "84"
 *                   nbNumeros:
 *                     type: integer
 *                     description: Nombre total de numéros d'adresse.
 *                     example: 440
 *                   nbVoies:
 *                     type: integer
 *                     description: Nombre total de voies.
 *                     example: 68
 *                   nbNumerosCertifies:
 *                     type: integer
 *                     description: Nombre de numéros certifiés par la commune.
 *                     example: 0
 *                   typeComposition:
 *                     type: string
 *                     description: Type de composition de l'adressage.
 *                     example: "assemblage"
 *                   analyseAdressage:
 *                     type: object
 *                     properties:
 *                       nbAdressesAttendues:
 *                         type: integer
 *                         description: Nombre d'adresses attendues.
 *                         example: 359
 *                       ratio:
 *                         type: integer
 *                         description: Ratio d'adressage en pourcentage.
 *                         example: 123
 *                       deficitAdresses:
 *                         type: boolean
 *                         description: Indique si la commune a un déficit d'adresses.
 *                         example: false
 *       400:
 *         description: Requête invalide.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bad request"
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */

app.get(
  '/api/communes-summary',
  analyticsMiddleware.communesSummary,
  w(async (req, res) => {
    const communesSummary = await getCommunesSummary()
    res.send(communesSummary)
  })
)
/**
 * @swagger
 * /api/communes-summary.csv:
 *   get:
 *     summary: Exporter un résumé des communes au format CSV
 *     description: Récupère un résumé des données des communes et les exporte sous forme de fichier CSV. Applique un middleware d'analyse.
 *     tags:
 *       - 🏘️ Communes & Composition d’adresses
 *     responses:
 *       200:
 *         description: Fichier CSV contenant le résumé des communes.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               example: |
 *                 region,departement,code_commune,nom_commune,population,id_revision,date_revision,type_composition,nb_lieux_dits,nb_voies,nb_numeros,nb_numeros_certifies,analyse_adressage_nb_adresses_attendues,analyse_adressage_ratio,analyse_adressage_deficit_adresses,composed_at
 *                 Île-de-France,75,75056,Paris,2148327,1,2023-12-01,full,50,1200,350000,300000,400000,0.87,1,2023-12-01
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */

app.get(
  '/api/communes-summary.csv',
  analyticsMiddleware.exportCommunesSummary,
  w(async (req, res) => {
    const communesSummary = (await getCommunesSummary()).map(c => {
      const s = {...c}

      /* eslint-disable camelcase */
      if (c.analyseAdressage) {
        s.analyse_adressage_nb_adresses_attendues
          = c.analyseAdressage.nbAdressesAttendues || ''
        s.analyse_adressage_ratio
          = 'ratio' in c.analyseAdressage ? c.analyseAdressage.ratio : ''
        s.analyse_adressage_deficit_adresses
          = 'deficitAdresses' in c.analyseAdressage
            ? (c.analyseAdressage.deficitAdresses
              ? '1'
              : '0')
            : ''
      }
      /* eslint-enable camelcase */

      return s
    })

    const columns = [
      'region',
      'departement',
      'code_commune',
      'nom_commune',
      'population',
      'id_revision',
      'date_revision',
      'type_composition',
      'nb_lieux_dits',
      'nb_voies',
      'nb_numeros',
      'nb_numeros_certifies',
      'analyse_adressage_nb_adresses_attendues',
      'analyse_adressage_ratio',
      'analyse_adressage_deficit_adresses',
      'composed_at',
    ]
    const csv = Papa.unparse(
      communesSummary.map(c => mapKeys(c, (v, k) => snakeCase(k))),
      {columns}
    )
    res.type('csv').send(csv)
  })
)

/**
 * @swagger
 * components:
 *   schemas:
 *     LookupError:
 *       type: object
 *       required:
 *         - code
 *         - message
 *       properties:
 *         code:
 *           type: integer
 *           description: Code d'erreur HTTP
 *         message:
 *           type: string
 *           description: Message d'erreur détaillé
 *     Commune:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Identifiant de la commune
 *         type:
 *           type: string
 *           description: Type d'entité (commune)
 *         codeCommune:
 *           type: string
 *           description: Code INSEE de la commune
 *         banId:
 *           type: string
 *           description: Identifiant BAN de la commune
 *         nomCommune:
 *           type: string
 *           description: Nom de la commune
 *         departement:
 *           type: object
 *           properties:
 *             nom:
 *               type: string
 *               description: Nom du département
 *             code:
 *               type: string
 *               description: Code du département
 *         region:
 *           type: object
 *           properties:
 *             nom:
 *               type: string
 *               description: Nom de la région
 *             code:
 *               type: string
 *               description: Code de la région
 *         codesPostaux:
 *           type: array
 *           items:
 *             type: string
 *           description: Liste des codes postaux de la commune
 *         population:
 *           type: integer
 *           description: Population de la commune
 *         typeCommune:
 *           type: string
 *           description: Type de commune (commune-actuelle, etc.)
 *         nbNumeros:
 *           type: integer
 *           description: Nombre de numéros dans la commune
 *         nbNumerosCertifies:
 *           type: integer
 *           description: Nombre de numéros certifiés dans la commune
 *         nbVoies:
 *           type: integer
 *           description: Nombre de voies dans la commune
 *         nbLieuxDits:
 *           type: integer
 *           description: Nombre de lieux-dits dans la commune
 *         typeComposition:
 *           type: string
 *           description: Type de composition (bal, etc.)
 *         displayBBox:
 *           type: array
 *           items:
 *             type: number
 *           description: Bounding box de la commune
 *         idRevision:
 *           type: string
 *           description: Identifiant de la révision
 *         dateRevision:
 *           type: string
 *           format: date-time
 *           description: Date de la révision
 *         voies:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Voie'
 *           description: Liste des voies de la commune
 *     Voie:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Identifiant de la voie
 *         type:
 *           type: string
 *           description: Type d'entité (voie)
 *         banId:
 *           type: string
 *           description: Identifiant BAN de la voie
 *         idVoie:
 *           type: string
 *           description: Identifiant de la voie
 *         nomVoie:
 *           type: string
 *           description: Nom de la voie
 *         nomVoieAlt:
 *           type: object
 *           description: Noms alternatifs de la voie
 *         sourceNomVoie:
 *           type: string
 *           description: Source du nom de la voie
 *         sources:
 *           type: array
 *           items:
 *             type: string
 *           description: Sources de la voie
 *         nbNumeros:
 *           type: integer
 *           description: Nombre de numéros dans la voie
 *         nbNumerosCertifies:
 *           type: integer
 *           description: Nombre de numéros certifiés dans la voie
 *         numeros:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Numero'
 *           description: Liste des numeros de la voie
 *     Numero:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           description: Type d'entité (numero)
 *         id:
 *           type: string
 *           description: Identifiant du numéro
 *         numero:
 *           type: string
 *           description: Numéro de la voie
 *         suffixe:
 *           type: string
 *           nullable: true
 *           description: Suffixe du numéro
 *         idVoie:
 *           type: string
 *           description: Identifiant de la voie
 *         parcelles:
 *           type: array
 *           items:
 *             type: string
 *           description: Liste des parcelles associées
 *         sources:
 *           type: array
 *           items:
 *             type: string
 *           description: Sources du numéro
 *         position:
 *           type: object
 *           description: Position géographique du numéro
 *         positionType:
 *           type: string
 *           description: Type de position
 *         sourcePosition:
 *           type: string
 *           description: Source de la position
 *         certifie:
 *           type: boolean
 *           description: Indique si le numéro est certifié
 *         codePostal:
 *           type: string
 *           description: Code postal du numéro
 *         libelleAcheminement:
 *           type: string
 *           description: Libellé d'acheminement
 *         banId:
 *           type: string
 *           description: Identifiant BAN du numéro
 *         banIdDistrict:
 *           type: string
 *           description: Identifiant BAN du district
 *         banIdMainCommonToponym:
 *           type: string
 *           description: Identifiant BAN du toponyme principal
 *         banIdSecondaryCommonToponyms:
 *           type: array
 *           items:
 *             type: string
 *           nullable: true
 *           description: Liste des identifiants BAN des toponymes secondaires
 *         cleInterop:
 *           type: string
 *           description: Clé d'interopérabilité du numéro
 *         codeAncienneCommune:
 *           type: string
 *           nullable: true
 *           description: Ancien code INSEE de la commune (si applicable)
 *         config:
 *           type: object
 *           description: Configuration spécifique du numéro
 *         dateMAJ:
 *           type: string
 *           format: date-time
 *           description: Date de mise à jour
 *         displayBBox:
 *           type: array
 *           items:
 *             type: number
 *           description: Bounding box de l'entité
 *         lat:
 *           type: number
 *           format: float
 *           description: Latitude
 *         lon:
 *           type: number
 *           format: float
 *           description: Longitude
 *         nomAncienneCommune:
 *           type: string
 *           nullable: true
 *           description: Nom de l'ancienne commune (si applicable)
 *         positions:
 *           type: array
 *           items:
 *             type: object
 *           description: Liste des positions possibles
 *         tiles:
 *           type: array
 *           items:
 *             type: string
 *           description: Liste des tuiles associées au numéro
 *         withBanId:
 *           type: boolean
 *           description: Indique si le numéro contient un `banId`
 *         x:
 *           type: number
 *           description: Coordonnée X (projection Lambert 93)
 *         y:
 *           type: number
 *           description: Coordonnée Y (projection Lambert 93)
 *         voie:
 *           $ref: '#/components/schemas/Voie'
 *         commune:
 *           $ref: '#/components/schemas/Commune'
 */

/**
 * @swagger
 * /lookup/{id}:
 *   get:
 *     summary: Recherche d'entité par identifiant
 *     description: |
 *       Récupère une entité (commune, voie ou numéro) en fonction de l'identifiant fourni.
 *       Le type d'entité est automatiquement déterminé par la longueur de l'identifiant:
 *       - Identifiant de 5 caractères: Commune
 *       - Identifiant de 10 ou 12 caractères: Voie
 *       - Identifiant de 16 caractères ou plus: Numéro
 *     operationId: lookupEntity
 *     tags:
 *       - 📊 Suivi, Statistiques & Recherche
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Identifiant de l'entité à rechercher
 *         examples:
 *           commune:
 *             value: "44193"
 *             summary: Identifiant d'une commune
 *           voie:
 *             value: "44193_i4r1x3"
 *             summary: Identifiant d'une voie
 *           numero:
 *             value: "44193_i4r1x3_1"
 *             summary: Identifiant d'un numéro
 *     responses:
 *       200:
 *         description: Entité trouvée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/Commune'
 *                 - $ref: '#/components/schemas/Voie'
 *                 - $ref: '#/components/schemas/Numero'
 *             examples:
 *               commune:
 *                 value:
 *                   id: "44193"
 *                   type: "commune"
 *                   codeCommune: "44193"
 *                   banId: "0211a559-f45b-4077-b5c7-d4ca2cbf4a73"
 *                   nomCommune: "Saint-Vincent-des-Landes"
 *                   departement:
 *                     nom: "Loire-Atlantique"
 *                     code: "44"
 *                   region:
 *                     nom: "Pays de la Loire"
 *                     code: "52"
 *                   codesPostaux: ["44590"]
 *                   population: 1529
 *                   typeCommune: "commune-actuelle"
 *                   nbNumeros: 775
 *                   nbNumerosCertifies: 725
 *                   nbVoies: 112
 *                   nbLieuxDits: 0
 *                   typeComposition: "bal"
 *                   displayBBox: [-1.564, 47.633, -1.441, 47.688]
 *                   idRevision: "67c4b59703eef8e5f9647201"
 *                   dateRevision: "2025-03-02T19:46:33.291Z"
 *                   voies:
 *                     - id: "44193_i4r1x3"
 *                       type: "voie"
 *                       banId: "526b301a-28d7-4d0e-ae25-64a1eb564b81"
 *                       idVoie: "44193_i4r1x3"
 *                       nomVoie: "la Tripardais"
 *                       nomVoieAlt: {}
 *                       sourceNomVoie: "bal"
 *                       sources: ["bal"]
 *                       nbNumeros: 3
 *                       nbNumerosCertifies: 3
 *                 summary: Exemple de réponse pour une commune
 *               voie:
 *                 value:
 *                   id: "44193_i4r1x3"
 *                   type: "voie"
 *                   banId: "526b301a-28d7-4d0e-ae25-64a1eb564b81"
 *                   idVoie: "44193_i4r1x3"
 *                   nomVoie: "la Tripardais"
 *                   nomVoieAlt: {}
 *                   sourceNomVoie: "bal"
 *                   sources: ["bal"]
 *                   nbNumeros: 3
 *                   nbNumerosCertifies: 3
 *                   commune:
 *                     id: "44193"
 *                     banId: "0211a559-f45b-4077-b5c7-d4ca2cbf4a73"
 *                     nom: "Saint-Vincent-des-Landes"
 *                     code: "44193"
 *                     departement:
 *                       nom: "Loire-Atlantique"
 *                       code: "44"
 *                     region:
 *                       nom: "Pays de la Loire"
 *                       code: "52"
 *                   numeros:
 *                     - banId: "526b301a-28d7-4d0e-ae25-64a1eb564b81"
 *                       certifie: "true"
 *                       codePostal	: "la Tripardais"
 *                       dateMAJ	: "{}"
 *                       id	: "64102_0127_00001"
 *                       libelleAcheminement : "BAYONNE"
 *                       lieuDitComplementNom :	"null"
 *                       lieuDitComplementNomAlt : "{}"
 *                       numero :	1
 *                 summary: Exemple de réponse pour une voie
 *               numero:
 *                 value:
 *                   type: "numero"
 *                   id: "64102_0127_00001"
 *                   numero: "1"
 *                   suffixe: null
 *                   idVoie: "64102_0127"
 *                   parcelles: ["640102000AV0109"]
 *                   sources: ["bal"]
 *                   position:
 *                     type: "Point"
 *                     coordinates: [-1.4530955186924766, 43.498224743564066]
 *                   positionType: "entrée"
 *                   sourcePosition: "bal"
 *                   certifie: true
 *                   codePostal: "64100"
 *                   libelleAcheminement: "BAYONNE"
 *                   banId: "d9d820f2-82af-4ca4-abd4-b379d393e569"
 *                   dateMAJ: "2014-05-01T00:00:00.000Z"
 *                   voie:
 *                     id: "64102_0127"
 *                     nomVoie: "Avenue André Harambillet"
 *                     nomVoieAlt:
 *                       eus: "André Harambillet etorbidea"
 *                   commune:
 *                     id: "64102"
 *                     nom: "Bayonne"
 *                     code: "64102"
 *                     departement:
 *                       nom: "Pyrénées-Atlantiques"
 *                       code: "64"
 *                     region:
 *                       nom: "Nouvelle-Aquitaine"
 *                       code: "75"
 *                 summary: Exemple de réponse pour un numéro
 *       400:
 *         description: Type d'identifiant inconnu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupError'
 *             example:
 *               code: 400
 *               message: "Type d'identifiant inconnu"
 *       404:
 *         description: Entité non trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupError'
 *             examples:
 *               communeNotFound:
 *                 value:
 *                   code: 404
 *                   message: "La commune n'existe pas"
 *                 summary: Commune non trouvée
 *               voieNotFound:
 *                 value:
 *                   code: 404
 *                   message: "La voie n'existe pas"
 *                 summary: Voie non trouvée
 *               numeroNotFound:
 *                 value:
 *                   code: 404
 *                   message: "Le numéro n'existe pas"
 *                 summary: Numéro non trouvé
 *       500:
 *         description: Erreur interne du serveur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LookupError'
 *             example:
 *               code: 500
 *               message: "Internal server error"
 */
app.get(
  '/lookup/:id',
  analyticsMiddleware.lookup,
  w(async (req, res) => {
    const {id} = req.params
    const typeID = getLegacyTypeFromId(id)

    if (typeID === 'Commune') {
      const commune = await getPopulatedCommune(id)

      if (!commune) {
        return res
          .status(404)
          .send({code: 404, message: 'La commune n’existe pas'})
      }

      return res.send(commune)
    }

    if (typeID === 'Voie') {
      const voie = await getPopulatedVoie(id)

      if (!voie) {
        return res
          .status(404)
          .send({code: 404, message: 'La voie n’existe pas'})
      }

      return res.send(voie)
    }

    if (typeID === 'Numéro') {
      const numero = await getPopulatedNumero(id)

      if (!numero) {
        return res
          .status(404)
          .send({code: 404, message: 'Le numéro n’existe pas'})
      }

      return res.send(numero)
    }

    res.status(400).send({code: 400, message: 'Type d’identifiant inconnu'})
  })
)

/**
 * @swagger
 * /tiles/ban/{z}/{x}/{y}.pbf:
 *   get:
 *     summary: Récupérer une tuile MVT des adresses et toponymes
 *     description: |
 *       Permet de récupérer une tuile au format Mapbox Vector Tile (MVT) contenant les données des adresses et toponymes pour un niveau de zoom et des coordonnées spécifiques.
 *       Les tuiles sont disponibles uniquement pour les niveaux de zoom compris entre 10 et 14 inclus.
 *     tags:
 *       - 🗺️ Cartographie & Tuiles
 *     parameters:
 *       - in: path
 *         name: z
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 10
 *           maximum: 14
 *         description: Niveau de zoom de la tuile (entre 10 et 14).
 *       - in: path
 *         name: x
 *         required: true
 *         schema:
 *           type: integer
 *         description: Coordonnée X de la tuile dans le système de tuilage Web Mercator.
 *       - in: path
 *         name: y
 *         required: true
 *         schema:
 *           type: integer
 *         description: Coordonnée Y de la tuile dans le système de tuilage Web Mercator.
 *     responses:
 *       200:
 *         description: Tuile MVT récupérée avec succès.
 *         content:
 *           application/x-protobuf:
 *             schema:
 *               type: string
 *               format: binary
 *               description: Données MVT contenant les adresses et toponymes encodées en PBF.
 *       404:
 *         description: Tuile non trouvée ou niveau de zoom invalide.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "Tuile non trouvée ou niveau de zoom invalide"
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "Erreur interne du serveur"
 */

// BAN Stats
app.get(
  '/ban/stats',
  w(async (req, res) => {
    const metric = await Metric.getLastMetric('ban-stats')
    res.send(metric.value)
  })
)

/**
 * @swagger
 * /ban/stats:
 *   get:
 *     summary: Récupération des statistiques de la BAN
 *     description: Renvoie les dernières statistiques de la Base Adresse Nationale (BAN).
 *     tags:
 *       - 📊 Suivi, Statistiques & Recherche
 *     responses:
 *       200:
 *         description: Statistiques récupérées avec succès.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 value:
 *                   type: object
 *                   description: Dernières statistiques de la BAN.
 *       500:
 *         description: Erreur interne du serveur.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
app.post(
  '/ban/stats',
  w(async (req, res) => {
    const {codesCommune} = req.body
    if (!codesCommune || codesCommune.length === 0) {
      return res
        .status(404)
        .send({code: 404, message: 'Paramètre codesCommune manquant ou invalide'})
    }

    try {
      const stats = await computeFilteredStats(codesCommune)
      res.send(stats)
    } catch (error) {
      console.error(error)
      res.status(500).send({code: 500, message: 'Une erreur est survenu lors du calcul des statistiques'})
    }
  }))

// BAN Carto Tiles
app.get(
  '/tiles/ban/:z/:x/:y.pbf',
  w(async (req, res) => {
    req.x = Number.parseInt(req.params.x, 10)
    req.y = Number.parseInt(req.params.y, 10)
    req.z = Number.parseInt(req.params.z, 10)

    if (req.z < 10 || req.z > 14) {
      return res.sendStatus(404)
    }

    const [adresses, toponymes] = await Promise.all([
      getAdressesFeatures(req.z, req.x, req.y),
      getToponymesFeatures(req.z, req.x, req.y),
    ])

    req.layersFeatures = {adresses, toponymes}

    await serveMvt(req, res)
  })
)

module.exports = app
