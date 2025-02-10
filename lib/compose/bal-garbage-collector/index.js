import {idFixComputeFromCogs} from '../../util/api-id-fix.cjs'
import {getCurrentRevisons} from '../../util/api-depot.cjs'
import {getCommuneRevisionID} from './models.js'

export const balGarbageCollector = async () => {
  try {
    console.info('BAL garbage collector start')
    const [revisionBAL, revisionBAN] = await Promise.all([
      getCurrentRevisons(),
      getCommuneRevisionID()
    ])

    const idRevisionBAL = revisionBAL.map(({id, codeCommune}) => [codeCommune, id])
    const idRevisionBAN = Object.fromEntries(revisionBAN.map(({idRevision, codeCommune}) => [codeCommune, idRevision]))

    const codesCommunes = idRevisionBAL.filter(([codeCommune, idRevision]) => idRevisionBAN[codeCommune] !== idRevision)
      .map(([codeCommune]) => codeCommune)
    console.info(`Re-syncronizing district cogs : ${codesCommunes.join(',')}`)
    // Seding the list of cogs to the id-fix API not waiting for the response
    idFixComputeFromCogs(codesCommunes)
    console.info('BAL garbage collector end')
    return codesCommunes
  } catch (error) {
    console.error('BAL garbage collector error', error)
  }
}

export default balGarbageCollector
