import fs from 'node:fs/promises'
import path, {dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

export const loadBanFile = async path => {
  try {
    const response = await fs.readFile(path, 'utf8')
    const data = JSON.parse(response)

    if (data.status !== 'success') {
      throw new Error('BAN file loading error', {values: {path}})
    }

    return data.response
  } catch (error) {
    throw new Error('Error on loading BAN file', {cause: error, values: {path}})
  }
}

export const loadConfigFile = async path => {
  try {
    const response = await fs.readFile(path, 'utf8')
    return JSON.parse(response)
  } catch (error) {
    throw new Error('Error on loading config file', {cause: error, values: {path}})
  }
}

export const loadHelpFile = async lang => {
  console.log(`La langue du système est: ${lang}`)
  const __dirname = dirname(fileURLToPath(import.meta.url))
  let helpFilePath
  try {
    const filePath = path.resolve(__dirname, `help.${lang}.txt`)
    await fs.access(filePath)
    helpFilePath = filePath
  } catch {
    helpFilePath = path.resolve(__dirname, 'help.en.txt')
  }

  try {
    const response = await fs.readFile(helpFilePath, 'utf8')
    return response
  } catch (error) {
    throw new Error('Error on loading help file', {cause: error, values: {path: helpFilePath}})
  }
}
