#!/usr/bin/env node
import fs from 'node:fs/promises'
import Path from 'node:path'

import minimist from 'minimist'
import Papa from 'papaparse'

import convertBan from './ban-converter.js'
import preconfig from './preconfig.js'
import SpinnerLogger from './spinner-logger.js'
import {loadBanFile, loadConfigFile, loadHelpFile} from './file-loaders.js'

const main = async (inputPath, configPathOrName = 'bal', outputPath = '', options) => {
  const {quiet} = options
  const logger = new SpinnerLogger(!quiet)

  try {
    logger.start('Convert BAN data')

    const banData = await loadBanFile(inputPath)
    const configParam = preconfig?.[configPathOrName] || await loadConfigFile(configPathOrName)
    const {config, name, fileExtention, csvConfig} = configParam
    const resultData = await convertBan(banData, config)

    let result
    switch (fileExtention) {
      case 'csv':
        result = Papa.unparse(resultData, csvConfig)
        break
      case 'json':
        result = JSON.stringify(resultData, null, 2)
        break
      case null:
      case undefined:
        throw new Error('File extention is required', {
          cause: 'Missing file extention',
          values: {fileExtention},
        })
      default:
        throw new Error(`'.${fileExtention}' File extention is not supported`,
          {
            cause: 'Unsupported file extention',
            values: {fileExtention},
          })
    }

    const dateFile = `${(new Date()).toLocaleString('FR-fr').replace(/\//g, '-').replace(/:/, 'h').replace(/:/, 'm').replace(/\s/, '_')}s`
    const outputFilePath = (new RegExp(`.${fileExtention}$`)).test(outputPath) ? outputPath : null
    const resultFilePath = outputFilePath || Path.join(outputPath, `${'export'}_${name}_${dateFile}.${fileExtention}`)
    await fs.writeFile(resultFilePath, result)

    logger.succeed(`Conversion ready: ${Path.join(process.cwd(), resultFilePath)}`)
  } catch (error) {
    logger.fail(error)
  }
}

const {
  _: [inputFile, outputFile],
  v, version,
  h, help,
  c, config,
  s, silence, quiet
} = minimist(process.argv.slice(2))
const banFilePath = inputFile
const options = {quiet: s || silence || quiet}

if (version || v) {
  console.log('ban-converter v0.1.0-beta.0')
  process.exit(0)
}

if (help || h) {
  const {env} = process
  const sysLang = (env.LANG || env.LANGUAGE || env.LC_ALL || env.LC_MESSAGES)?.split('_')?.[0]
  const helpText = await loadHelpFile(sysLang)
  console.log(helpText)
  process.exit(0)
}

main(banFilePath, c || config, outputFile, options)
