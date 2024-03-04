import 'dotenv/config.js' // eslint-disable-line import/no-unassigned-import
import {execSync} from 'node:child_process'
import {join} from 'node:path'
import {createWriteStream, createReadStream, promises as fsPromises, rmdirSync, existsSync, readdirSync} from 'node:fs'
import {GetObjectCommand} from '@aws-sdk/client-s3'
import s3 from '../lib/util/s3.cjs'

const {S3_CONFIG_BUCKET} = process.env

const prefixBase = 'ban/adresses/latest'
const tempFolderName = 'dist'
const nationalFilesConfig = [{
  type: 'csv-bal',
  filePrefix: 'adresses-',
  fileName: 'adresses-france.csv.gz',
}, {
  type: 'csv',
  filePrefix: 'adresses-',
  fileName: 'adresses-france.csv.gz',
}, {
  type: 'csv',
  filePrefix: 'lieux-dits-',
  fileName: 'lieux-dits-beta-france.csv.gz',
}, {
  type: 'csv-with-ids',
  filePrefix: 'adresses-',
  fileName: 'adresses-with-ids-france.csv.gz',
}, {
  type: 'csv-with-ids',
  filePrefix: 'lieux-dits-',
  fileName: 'lieux-dits-with-ids-beta-france.csv.gz',
}, {
  type: 'addok',
  filePrefix: 'adresses-',
  fileName: 'adresses-addok-france.ndjson.gz',
}]

const downloadAndWriteFile = async (folderPath, key) => {
  const s3Client = s3.initializeS3Client()
  const fileName = key.split('/').pop()
  await fsPromises.mkdir(folderPath, {recursive: true})

  const outputStream = createWriteStream(`${folderPath}/${fileName}`)
  const getObjectCommand = new GetObjectCommand({
    Bucket: S3_CONFIG_BUCKET,
    Key: key,
  })

  const data = await s3Client.send(getObjectCommand)
  data.Body.pipe(outputStream)

  return new Promise((resolve, reject) => {
    // Resolve the promise when the download is complete
    outputStream.on('close', () => {
      resolve()
    })

    // Reject the promise on error
    outputStream.on('error', err => {
      console.error(`Error downloading file ${key}:`, err)
      reject(err)
    })
  })
}

const concatenateCSVFiles = async (folderPath, prefix, outputFileName) => {
  const outputFilePath = join(folderPath, outputFileName)
  try {
    if (outputFileName === 'adresses-addok-france.ndjson.gz') {
      const files = readdirSync(folderPath).filter(file =>
        file.startsWith(prefix) && file.endsWith('.ndjson.gz') && file !== outputFileName)
      files.forEach(filename => {
        const filePath = join(folderPath, filename)
        execSync(`cat ${filePath} > ${outputFilePath}`, {stdio: 'inherit'})
      })
    } else {
      const csvFiles = readdirSync(folderPath).filter(file =>
        file.startsWith(prefix) && file.endsWith('.csv.gz') && file !== outputFileName)
      const headerFileName = csvFiles[0]
      const headerFilePath = join(folderPath, headerFileName)
      execSync(`zcat < ${headerFilePath} | head -n 1 | gzip > ${outputFilePath}`, {stdio: 'inherit'})

      csvFiles.forEach(filename => {
        const filePath = join(folderPath, filename)
        execSync(`zcat < ${filePath} | sed 1d | gzip >> ${outputFilePath}`, {stdio: 'inherit'})
      })
    }
  } catch (error) {
    console.error('Error concatenating CSV files:', error)
  }
}

const uploadFileToS3 = async (inputFilePath, outputPath) => {
  const fileStream = createReadStream(inputFilePath)
  const {writeStream, uploadDonePromise} = s3.uploadFileToS3Stream(outputPath)
  fileStream.pipe(writeStream)
  return uploadDonePromise
}

const removeTempDirectory = () => {
  if (existsSync(tempFolderName)) {
    try {
      rmdirSync(tempFolderName, {recursive: true})
      console.log(`Folder "${tempFolderName}" deleted successfully.`)
    } catch (error) {
      console.error(`Error deleting folder "${tempFolderName}": ${error.message}`)
    }
  } else {
    console.log(`Folder "${tempFolderName}" does not exist.`)
  }
}

// Run the main function
const main = async () => {
  try {
    // Delete the temp folder if it exists
    removeTempDirectory()

    const responsePromises = nationalFilesConfig.map(async ({type, filePrefix, fileName}) => {
      // Download the files from S3 and write them to the temp folder
      const filesToDownloadPrefix = `${prefixBase}/${type}/${filePrefix}`
      const objets = await s3.listObjects(filesToDownloadPrefix)
      const fileKeys = objets.Contents.map(object => object.Key)
      const fileKeysFiltered = fileKeys.filter(key => !key.includes(fileName))
      const tempFolderPath = `${tempFolderName}/${prefixBase}/${type}`
      await Promise.all(fileKeysFiltered.map(fileKey => downloadAndWriteFile(tempFolderPath, fileKey)))
      console.log(`All ${type} files with "${filePrefix}" prefix downloaded successfully.`)

      // Concatenate the CSV files into a national file
      await concatenateCSVFiles(`${tempFolderName}/${prefixBase}/${type}`, filePrefix, fileName)
      console.log(`All ${type} files with "${filePrefix}" prefix concatenated successfully.`)

      // Upload the national file to S3
      const fileToUploadPath = `${tempFolderName}/${prefixBase}/${type}/${fileName}`
      const fileToUploadPrefix = `${prefixBase}/${type}/${fileName}`
      return uploadFileToS3(fileToUploadPath, fileToUploadPrefix)
    })
    await Promise.all(responsePromises)
    console.log('All files uploaded successfully.')

    // Delete the temp folder
    removeTempDirectory()
  } catch (error) {
    console.error(error)
  }
}

main()
