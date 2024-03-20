import {idFixComputeFromCog} from '../../util/api-id-fix.cjs'
import {getCurrentRevisons} from '../../util/api-depot.cjs'
import {getCommuneRevisionID} from './models.js'

export const balGarbageCollector = async () => {
  try {
    console.info('BAL garbage collector start')
    const [revisionBAL, revisionBAN] = await Promise.all([
      getCurrentRevisons(),
      getCommuneRevisionID()
    ])

    const idRevisionBAL = revisionBAL.map(({_id, codeCommune}) => [codeCommune, _id])
    const idRevisionBAN = Object.fromEntries(revisionBAN.map(({idRevision, codeCommune}) => [codeCommune, idRevision]))

    const codesCommunes = idRevisionBAL.filter(([codeCommune, idRevision]) => idRevisionBAN[codeCommune] !== idRevision)
    const communeComposed = await Promise.all(codesCommunes.map(([codeCommune]) => {
      console.info(`Re-syncronizing district cog ${codeCommune} by sending a request to id-fix api...`)
      return idFixComputeFromCog(codeCommune)
    }))
    console.info('BAL garbage collector end')
    return communeComposed
  } catch (error) {
    console.error('BAL garbage collector error', error)
  }
}

export default balGarbageCollector
