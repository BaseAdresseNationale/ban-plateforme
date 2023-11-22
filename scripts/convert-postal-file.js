#!/usr/bin/env node
import fs from 'node:fs'
import Papa from 'papaparse'

try {
  const [inputFileName, outputFileName, isIndent] = process.argv.slice(2)

  if (!inputFileName) {
    throw new Error('Missing argument : source_file')
  }

  if (inputFileName === '-h' || inputFileName === '--help') {
    console.info(`
  This script converts the csv file from french national post services (La Poste)
  into json file with 'codeInsee' as key
  This csv file can be download from: https://datanova.laposte.fr/data-fair/api/v1/datasets/laposte-hexasmal/data-files/019HexaSmal.csv
  Usage: node convert-postal-file.js [options] source_file target_file [is_indent]
  
  source_file    path to input csv file
  target_file    path to output json file
  is_indent      if 1, output file will be indented (default: 0)

  Options:
  -h, --help     print node command line options (currently set)
  `)
    process.exit(0)
  }

  if (!outputFileName) {
    throw new Error('Missing argument : target_file')
  }

  const headers = ['codeInsee', 'nomCommune', 'codePostal', 'libelleAcheminement', 'ligne5']

  const file = fs.readFileSync(inputFileName, 'utf8')
  const dataRaw = Papa.parse(file, {
    header: true,
    transformHeader: (name, i) => headers[i],
    skipEmptyLines: true,
  })

  if (dataRaw.errors.length > 0) {
    throw new Error(dataRaw.errors)
  }

  const data = dataRaw.data.reduce((acc, entry) => {
    const {codeInsee, nomCommune, codePostal, libelleAcheminement} = entry
    acc[codeInsee] = {
      codeInsee,
      nomCommune,
      codePostal: [...new Set([...(acc[codeInsee]?.codePostal || []), codePostal])],
      libelleAcheminement
    }
    return acc
  }, {})

  fs.writeFileSync(outputFileName, JSON.stringify(data, null, isIndent ? 2 : null))
  console.info('Le fichier a été créé à ' + outputFileName)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
