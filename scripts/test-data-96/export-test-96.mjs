import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { validate, writePackage } from './fixture.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
try {
  const [output, ...extra] = process.argv.slice(2)
  if (!output || extra.length) throw new Error('Usage : node export-test-96.mjs <nouveau-dossier-de-sortie>')
  if (fs.existsSync(output)) throw new Error('Le dossier de sortie existe déjà : choisir un nouveau nom')
  const container = process.env.POSTGRES_CONTAINER || 'ban_postgres'
  const username = process.env.PG_USERNAME || 'ban_user'
  const database = process.env.SOURCE_DATABASE || 'ban'
  if (![container, username, database].every(s => /^[A-Za-z0-9_.-]+$/.test(s))) throw new Error('Nom de connexion invalide (nom simple requis)')
  console.error(`Export en lecture seule : conteneur=${container}, base=${database}, utilisateur=${username}`)
  const result = spawnSync('docker', ['exec', '--interactive', container, 'psql',
    `--username=${username}`, `--dbname=${database}`, '--no-psqlrc', '--quiet', '--tuples-only', '--no-align',
    '--set=ON_ERROR_STOP=1', `--set=SOURCE_DATABASE=${database}`], {
    input: fs.readFileSync(path.join(directory, 'export.sql'), 'utf8'), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) throw new Error(`Export refusé ou échoué : ${result.stderr || result.error?.message || result.status}`)
  const payload = JSON.parse(result.stdout)
  const counts = validate(payload)
  writePackage(payload, output)
  console.log(JSON.stringify({ output: path.resolve(output), counts, warning: 'Métadonnées à relire avant partage. Aucun import effectué.' }, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
