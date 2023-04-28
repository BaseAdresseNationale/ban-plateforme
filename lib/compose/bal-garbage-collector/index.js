import bluebird from 'bluebird'
import composeCommune from '../index.cjs'
import {getCurrentRevisons} from '../../util/api-depot.cjs'
import {getCommuneRevisionID} from './models.js'

const CONCURRENCY = 5

export const balGarbageCollector = async () => {
  const [revisionBAL, revisionBAN] = await Promise.all([
    getCurrentRevisons(),
    getCommuneRevisionID()
  ])

  const idRevisionBAL = revisionBAL.map(({_id, codeCommune}) => [codeCommune, _id])
  const idRevisionBAN = Object.fromEntries(revisionBAN.map(({idRevision, codeCommune}) => [codeCommune, idRevision]))

  const codesCommunes = idRevisionBAL.filter(([codeCommune, idRevision]) => idRevisionBAN[codeCommune] !== idRevision)

  // Promesses avec concurrence
  const communeComposed = await bluebird.map(codesCommunes, ([codeCommune]) => composeCommune(codeCommune), {concurrency: CONCURRENCY})
  return communeComposed
}
