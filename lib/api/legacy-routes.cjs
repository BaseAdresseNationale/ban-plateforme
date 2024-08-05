const fs = require('node:fs')
const express = require('express')
const Papa = require('papaparse')
const {snakeCase, mapKeys} = require('lodash')
const fetch = require('../util/fetch.cjs')
const currentDate = require('../util/local-current-date.cjs')
const {computeFilteredStats, computeScoringStats} = require('../models/ban.cjs')
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

// API-Legacy
app.post(
  '/ban/communes/:codeCommune/compose',
  ensureIsAdmin,
  w(async (req, res) => {
    const {codeCommune} = req.commune
    const {force} = req.body

    try {
      // Async Call to ID-Fix
      fetch(`${API_IDFIX_URL}/compute-from-cog/${codeCommune}?force=${force}`, {
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

app.get(
  '/api/communes-summary',
  analyticsMiddleware.communesSummary,
  w(async (req, res) => {
    const communesSummary = await getCommunesSummary()
    res.send(communesSummary)
  })
)

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

// BAN Stats
app.get(
  '/ban/stats',
  w(async (req, res) => {
    const metric = await Metric.getLastMetric('ban-stats')
    res.send(metric.value)
  })
)

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

app.get(
  '/ban/stats-scoring',
  w(async (req, res) => {
    const scores = await computeScoringStats()
    return res
      .send(scores)
  })
)

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
