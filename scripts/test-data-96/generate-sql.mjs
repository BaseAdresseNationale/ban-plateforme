import fs from 'node:fs'
import { render } from './fixture.mjs'

try {
  const [input, output, ...extra] = process.argv.slice(2)
  if (!input || !output || extra.length) throw new Error('Usage : node generate-sql.mjs <data.json> <nouveau-fichier.sql>')
  const sql = render(JSON.parse(fs.readFileSync(input, 'utf8')))
  fs.writeFileSync(output, sql, { flag: 'wx', mode: 0o600 })
  console.log(`SQL généré : ${output}. Aucune exécution PostgreSQL.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
