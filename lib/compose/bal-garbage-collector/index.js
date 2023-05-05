import {askComposition} from '../../models/commune.cjs'
import {getCurrentRevisons} from '../../util/api-depot.cjs'
import {getCommuneRevisionID} from './models.js'

export const balGarbageCollector = async () => {
  const [revisionBAL, revisionBAN] = await Promise.all([
    getCurrentRevisons(),
    getCommuneRevisionID()
  ])

  const idRevisionBAL = revisionBAL.map(({_id, codeCommune}) => [codeCommune, _id])
  const idRevisionBAN = Object.fromEntries(revisionBAN.map(({idRevision, codeCommune}) => [codeCommune, idRevision]))

  const codesCommunes = idRevisionBAL.filter(([codeCommune, idRevision]) => idRevisionBAN[codeCommune] !== idRevision)

  const communeComposed = await Promise.all(codesCommunes.map(([codeCommune]) => askComposition(codeCommune)))
  return communeComposed
}

export default balGarbageCollector
