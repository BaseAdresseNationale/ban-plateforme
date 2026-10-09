import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const TABLES = ['district', 'district_h', 'common_toponym', 'common_toponym_h', 'address', 'address_h']
const directory = path.dirname(fileURLToPath(import.meta.url))
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validate(payload) {
  if (payload.format !== 'ban-fixture-96-v1' || payload.department !== '96') throw new Error('Format ou département refusé')
  for (const container of [payload.tables, payload.schema]) {
    if (!container || Object.keys(container).sort().join() !== [...TABLES].sort().join()) throw new Error('Liste des tables invalide')
  }
  if (!payload.tables.district.length) throw new Error('Aucune commune fictive trouvée')
  for (const count of Object.values(payload.excluded_dependencies ?? {})) {
    if (count !== 0) throw new Error('Actions ou certificats associés : revoir le périmètre avant export')
  }
  if (Object.keys(payload.excluded_dependencies ?? {}).sort().join() !== 'actions,certificates') throw new Error('Audit des dépendances absent')
  const ids = Object.fromEntries(TABLES.filter(t => !t.endsWith('_h')).map(t => [t, new Set(payload.tables[t].map(r => r.id))]))
  for (const table of TABLES) {
    const rows = payload.tables[table]
    const columns = payload.schema[table]
    if (!Array.isArray(rows) || !Array.isArray(columns) || !columns.length) throw new Error(`Table invalide : ${table}`)
    const names = columns.map(c => c.name)
    if (new Set(names).size !== names.length || columns.some(c => typeof c.type !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(c.name))) throw new Error(`Colonnes invalides : ${table}`)
    if (!names.includes('range_validity') || !names.includes('updateDate') || columns.find(c => c.name === 'range_validity').type !== 'tstzrange') throw new Error(`Temporalité absente : ${table}`)
    const seen = new Set()
    for (const row of rows) {
      if (Object.keys(row).sort().join() !== [...names].sort().join()) throw new Error(`Colonnes de données incompatibles : ${table}`)
      if (!uuid.test(row.id)) throw new Error(`UUID invalide : ${table}`)
      const key = table.endsWith('_h') ? `${row.id}/${row.range_validity}` : row.id
      if (seen.has(key)) throw new Error(`Doublon : ${table}`)
      seen.add(key)
      if (table.endsWith('_h') && !ids[table.slice(0, -2)].has(row.id)) throw new Error(`Historique sans objet actuel : ${table}`)
      if (table.startsWith('district')) {
        if (!String(row.meta?.insee?.cog ?? '').startsWith('96')) throw new Error('Version de commune hors département 96 : examen manuel requis')
        const mainId = row.meta?.insee?.mainId
        if (mainId && !ids.district.has(mainId)) throw new Error('Référence mainId extérieure au jeu')
      } else if (!ids.district.has(row.districtID)) throw new Error(`Commune extérieure au jeu : ${table}`)
      if (table.startsWith('address')) {
        for (const ref of [row.mainCommonToponymID, ...(row.secondaryCommonToponymIDs ?? [])]) {
          if (ref && !ids.common_toponym.has(ref)) throw new Error('Toponyme extérieur au jeu')
        }
      }
    }
  }
  return Object.fromEntries(TABLES.map(t => [t, payload.tables[t].length]))
}

export function render(payload) {
  const counts = validate(payload)
  const json = JSON.stringify(payload, null, 2)
  let delimiter = '$ban_fixture$'
  while (json.includes(delimiter)) delimiter = delimiter.replace(/\$$/, '_$')
  const header = `-- Jeu fictif 96. Données uniquement ; ne pas exécuter dans ban.\n-- Effectifs : ${JSON.stringify(counts)}\n-- Modifier data.json puis régénérer ce SQL ; aucune exécution automatique.\n`
  const loading = `INSERT INTO fixture_payload VALUES (${delimiter}\n${json}\n${delimiter}::jsonb);\n`
  return header + fs.readFileSync(path.join(directory, 'import-before.sql'), 'utf8') + loading + fs.readFileSync(path.join(directory, 'import-after.sql'), 'utf8')
}

export function writePackage(payload, output) {
  const sql = render(payload)
  // Un dossier nouveau uniquement : aucun écrasement d'un export existant.
  fs.mkdirSync(output, { mode: 0o700 })
  fs.writeFileSync(path.join(output, 'data.json'), JSON.stringify(payload, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  fs.writeFileSync(path.join(output, 'test-96.sql'), sql, { flag: 'wx', mode: 0o600 })
}
