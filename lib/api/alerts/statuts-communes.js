import {createRequire} from 'node:module'
import {getLatestAlerts, getLatestWarnings, getAlertStatusForRevisionsBatch} from './utils.js'
import {getCommunesSummaryByCogs} from '../../models/commune.cjs'

const require = createRequire(import.meta.url)
const fetchWithProxy = require('../../util/fetch.cjs')

const API_DEPOT_URL = (process.env.API_DEPOT_URL || 'https://plateforme.adresse.data.gouv.fr/api-depot').trim()
const MAX_COGS = 1000
/** Cache /current-revisions, TTL 10 min. */
const CURRENT_REVISIONS_CACHE_TTL_MS = (Number(process.env.STATUTS_COMMUNES_CACHE_TTL_MINUTES) || 10) * 60 * 1000
let currentRevisionsCache = { data: null, expiresAt: 0 }
let currentRevisionsFetchPromise = null

async function safeFetch(url) {
  try {
    const response = await fetchWithProxy(url)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function fetchCurrentRevisionsCached() {
  const now = Date.now()
  if (currentRevisionsCache.data !== null && currentRevisionsCache.expiresAt > now) {
    return currentRevisionsCache.data
  }
  if (currentRevisionsFetchPromise) return currentRevisionsFetchPromise
  currentRevisionsFetchPromise = (async () => {
    try {
      const url = `${API_DEPOT_URL}/current-revisions`
      const data = await safeFetch(url)
      const raw = Array.isArray(data) ? data : (data?.data ?? data?.revisions ?? [])
      if (!Array.isArray(raw)) {
        currentRevisionsFetchPromise = null
        return new Map()
      }
      const byCog = new Map()
      for (const r of raw) {
        const cog = r.codeCommune != null ? String(r.codeCommune).padStart(5, '0') : null
        if (!cog || !/^\d{5}$/.test(cog)) continue
        const rev = { id: r.id, isCurrent: true, publishedAt: r.publishedAt ?? null }
        byCog.set(cog, [rev])
      }
      currentRevisionsCache = { data: byCog, expiresAt: now + CURRENT_REVISIONS_CACHE_TTL_MS }
      return byCog
    } finally {
      currentRevisionsFetchPromise = null
    }
  })()
  return currentRevisionsFetchPromise
}

export function computeStatutFromRevisions(idRevisionStocke, revisions, alertStatus = null) {
  const warning = label => ({status: 'warning', label})
  const error = label => ({status: 'error', label})
  const success = label => ({status: 'success', label})

  if (!revisions || revisions.length === 0) {
    return warning('Aucune révision')
  }

  const currentRevision = revisions.find(r => r.isCurrent === true)
  if (!currentRevision) {
    return error('Pas de révision courante')
  }

  const idStocke = idRevisionStocke != null ? String(idRevisionStocke) : null
  const currentId = currentRevision.id != null ? String(currentRevision.id) : null
  if (currentId !== idStocke) {
    if (currentRevision.publishedAt) {
      const publishedDate = new Date(currentRevision.publishedAt)
      const diffInHours = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60)
      if (diffInHours < 1) return warning('En cours')
    }
    return error('Erreur')
  }

  if (alertStatus?.status === 'error') return error('Erreur')
  if (alertStatus?.status === 'warning') return warning('Avertissement')
  return success('Valide')
}

export async function getStatutsForCogs(cogs) {
  const list = cogs.filter(c => typeof c === 'string' && /^\d{5}$/.test(c))
  if (list.length > MAX_COGS) {
    throw new Error(`Maximum ${MAX_COGS} communes par requête`)
  }

  const [errors, warnings, communesRows] = await Promise.all([
    getLatestAlerts(500),
    getLatestWarnings(1000),
    getCommunesSummaryByCogs(list)
  ])

  const cogsEnErreur = new Set((errors || []).map(r => r.cog).filter(Boolean))
  const cogsEnAvertissement = new Set((warnings || []).map(r => r.cog).filter(Boolean))
  const communeByCog = new Map()
  const idRevisionByCog = new Map()
  for (const r of communesRows || []) {
    const cog = String(r.codeCommune ?? '')
    if (!/^\d{5}$/.test(cog)) continue
    idRevisionByCog.set(cog, r.idRevision != null ? String(r.idRevision) : null)
    const nbNumeros = Number(r.nbNumeros) || 0
    const nbCertifies = Number(r.nbNumerosCertifies) || 0
    communeByCog.set(cog, {
      nomCommune: r.nomCommune ?? null,
      dateRevision: r.dateRevision ?? null,
      idRevision: r.idRevision != null ? String(r.idRevision) : null,
      nbVoies: Number(r.nbVoies) || 0,
      nbNumeros,
      nbLieuxDits: Number(r.nbLieuxDits) || 0,
      nbNumerosCertifies: nbCertifies,
      tauxCertifies: nbNumeros > 0 ? Math.round((nbCertifies / nbNumeros) * 100) : null
    })
  }

  const remaining = list.filter(c => !cogsEnErreur.has(c) && !cogsEnAvertissement.has(c))
  const currentRevisionsByCog = await fetchCurrentRevisionsCached()
  const revisionsByCog = new Map(remaining.map(cog => [cog, currentRevisionsByCog.get(cog) ?? []]))

  const cogsIdEgaux = []
  const statutsRestants = new Map()
  for (const cog of remaining) {
    const idStocke = idRevisionByCog.get(cog) ?? null
    const revisions = revisionsByCog.get(cog) ?? []
    const currentRevision = revisions.find(r => r.isCurrent === true)
    const computed = computeStatutFromRevisions(idStocke, revisions, null)
    if (currentRevision && currentRevision.id === idStocke) {
      cogsIdEgaux.push({cog, idRevisionStocke: idStocke})
    } else {
      statutsRestants.set(cog, computed)
    }
  }

  const alertStatusByCog = cogsIdEgaux.length > 0
    ? await getAlertStatusForRevisionsBatch(cogsIdEgaux)
    : new Map()

  for (const {cog, idRevisionStocke} of cogsIdEgaux) {
    const revisions = revisionsByCog.get(cog) ?? []
    statutsRestants.set(
      cog,
      computeStatutFromRevisions(idRevisionStocke, revisions, alertStatusByCog.get(cog) ?? null)
    )
  }

  return list.map(cog => {
    const base = {cog}
    const infos = communeByCog.get(cog) ?? {}
    if (cogsEnErreur.has(cog)) {
      return {...base, ...infos, status: 'error', label: 'Erreur'}
    }
    if (cogsEnAvertissement.has(cog)) {
      return {...base, ...infos, status: 'warning', label: 'Avertissement'}
    }
    const {status, label} = statutsRestants.get(cog) ?? {status: 'warning', label: 'Indisponible'}
    return {...base, ...infos, status, label}
  })
}
