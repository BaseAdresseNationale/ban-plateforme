/* eslint-disable unicorn/no-process-exit */
/* eslint-disable no-await-in-loop */
const {spawn} = require('node:child_process')
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const util = require('util')
const stream = require('stream')
const {S3Client, PutObjectCommand} = require('@aws-sdk/client-s3')

const pipeline = util.promisify(stream.pipeline)
const readdir = util.promisify(fs.readdir)

const config = {
  localDistPath: path.resolve(__dirname, '..', 'dist'),
  s3Bucket: process.env.S3_CONFIG_BUCKET,
  s3Prefix: 'adresse-data/ban/adresses/latest'
}

const s3Client = new S3Client({
  region: process.env.S3_CONFIG_REGION,
  endpoint: process.env.S3_CONFIG_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_CONFIG_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_CONFIG_SECRET_ACCESS_KEY,
  }
})

console.log(config.localDistPath)
async function runYarn(args) {
  return new Promise((resolve, reject) => {
    const yarn = spawn('yarn', args.split(' '))

    yarn.stdout.on('data', data => {
      console.log(`yarn: ${data}`)
    })

    yarn.stderr.on('data', data => {
      console.error(`yarn stderr: ${data}`)
    })

    yarn.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`yarn process exited with code ${code}`))
      }
    })
  })
}

async function removeDirectory(dirPath) {
  try {
    await fs.promises.rm(dirPath, {recursive: true, force: true})
    console.log(`Répertoire supprimé: ${dirPath}`)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }

    console.log(`Le répertoire n'existe pas: ${dirPath}`)
  }
}

async function createNationalFile(sourceDir, filePattern, outputPath, firstFileDept) {
  console.log(`Création du fichier national: ${outputPath}`)

  const tempOutputPath = `${outputPath}.tmp`
  const files = await readdir(sourceDir)
  const sourceFiles = files.filter(file => file.match(filePattern))

  if (sourceFiles.length === 0) {
    throw new Error(`Aucun fichier trouvé avec le motif: ${filePattern}`)
  }

  console.log(`Trouvé ${sourceFiles.length} fichiers à traiter`)

  const headerFile = sourceFiles.find(file => file.includes(firstFileDept)) || sourceFiles[0]
  const headerPath = path.join(sourceDir, headerFile)

  console.log(`Récupération du header depuis: ${headerFile}`)
  const headerContent = await getFileHeader(headerPath)
  await fs.promises.writeFile(tempOutputPath, headerContent)

  let processed = 0
  for (const file of sourceFiles) {
    const filePath = path.join(sourceDir, file)

    await appendFileWithoutHeader(filePath, tempOutputPath)
    processed++
    
    if (processed % 10 === 0) {
      console.log(`Traité ${processed}/${sourceFiles.length} fichiers`)
    }
  }

  console.log(`✓ Tous les ${sourceFiles.length} fichiers traités`)
  console.log('Compression en cours...')

  const gzipOutput = zlib.createGzip()
  const input = fs.createReadStream(tempOutputPath)
  const output = fs.createWriteStream(outputPath)
  await pipeline(input, gzipOutput, output)

  await fs.promises.unlink(tempOutputPath)
  
  // Vérifier la taille du fichier créé
  const stat = await fs.promises.stat(outputPath)
  console.log(` Fichier national créé: ${outputPath}`)
  console.log(` Taille: ${Math.round(stat.size / 1024 / 1024)} MB`)
}

// FONCTION CORRIGÉE - Le problème était ici !
async function getFileHeader(filePath) {
  return new Promise((resolve, reject) => {
    const gunzip = zlib.createGunzip()
    const fileStream = fs.createReadStream(filePath)
    let header = ''
    let headerFound = false

    const cleanup = () => {
      if (!fileStream.destroyed) fileStream.destroy()
    }

    fileStream.pipe(gunzip)
      .on('data', chunk => {
        if (!headerFound) {
          const data = chunk.toString()
          const newlineIndex = data.indexOf('\n')

          if (newlineIndex !== -1) {
            header = data.slice(0, newlineIndex + 1)
            headerFound = true
            cleanup()
            resolve(Buffer.from(header)) // CORRECTION: Résoudre immédiatement la Promise
          }
        }
      })
      .on('end', () => {
        if (!headerFound) {
          resolve(Buffer.from(header))
        }
      })
      .on('error', (err) => {
        cleanup()
        reject(err)
      })
  })
}

// FONCTION CORRIGÉE - Meilleure gestion des streams et de la mémoire
async function appendFileWithoutHeader(filePath, outputPath) {
  return new Promise((resolve, reject) => {
    const gunzip = zlib.createGunzip()
    const fileStream = fs.createReadStream(filePath)
    const outputStream = fs.createWriteStream(outputPath, {flags: 'a'})
    let isFirstLine = true

    const cleanup = () => {
      if (!fileStream.destroyed) fileStream.destroy()
      if (!outputStream.destroyed) outputStream.destroy()
    }

    fileStream.pipe(gunzip)
      .on('data', chunk => {
        if (isFirstLine) {
          const data = chunk.toString()
          const newlineIndex = data.indexOf('\n')

          if (newlineIndex !== -1) {
            outputStream.write(data.slice(newlineIndex + 1))
            isFirstLine = false
          }
        } else {
          outputStream.write(chunk)
        }
      })
      .on('end', () => {
        // CORRECTION: Attendre que l'écriture soit terminée
        outputStream.end(() => resolve())
      })
      .on('error', (err) => {
        cleanup()
        reject(err)
      })
  })
}

// FONCTION CORRIGÉE - Utilise des streams au lieu de charger en mémoire
async function mergeAddokFiles(sourceDir, filePattern, outputPath) {
  console.log(`Création du fichier addok: ${outputPath}`)

  const files = await readdir(sourceDir)
  const sourceFiles = files.filter(file => file.match(filePattern))

  if (sourceFiles.length === 0) {
    throw new Error(`Aucun fichier trouvé avec le motif: ${filePattern}`)
  }

  console.log(`Trouvé ${sourceFiles.length} fichiers addok à traiter`)

  const output = fs.createWriteStream(outputPath)

  try {
    for (const file of sourceFiles) {
      const filePath = path.join(sourceDir, file)
      
      // CORRECTION: Utiliser des streams au lieu de readFile pour éviter les problèmes de mémoire
      await new Promise((resolve, reject) => {
        const input = fs.createReadStream(filePath)
        
        input.on('data', chunk => {
          output.write(chunk)
        })
        
        input.on('end', () => {
          console.log(`Ajouté au fichier addok: ${file}`)
          resolve()
        })
        
        input.on('error', reject)
      })
    }

    // CORRECTION: Attendre que l'écriture soit terminée
    await new Promise((resolve) => {
      output.end(resolve)
    })
    
    // Vérifier la taille du fichier créé
    const stat = await fs.promises.stat(outputPath)
    console.log(` Fichier addok créé: ${outputPath}`)
    console.log(` Taille: ${Math.round(stat.size / 1024 / 1024)} MB`)
    
  } catch (error) {
    output.destroy()
    throw error
  }
}

async function syncToS3(localPath, s3Bucket, s3Prefix) {
  console.log(`Synchronisation vers S3: ${s3Bucket}/${s3Prefix}`)

  const folders = ['csv', 'addok', 'csv-bal', 'csv-with-ids', 'csv-bal-with-lang']

  for (const folder of folders) {
    const folderPath = path.join(localPath, folder)

    try {
      await fs.promises.access(folderPath, fs.constants.R_OK)

      const files = await readdir(folderPath)
      const fileList = []
      
      // AMÉLIORATION: Filtrer et préparer la liste des fichiers à uploader
      for (const file of files) {
        const filePath = path.join(folderPath, file)
        const stat = await fs.promises.stat(filePath)
        if (stat.isFile()) {
          fileList.push({path: filePath, name: file, size: stat.size})
        }
      }
      
      console.log(`Dossier ${folder}: ${fileList.length} fichiers à uploader`)

      let uploaded = 0
      let totalSize = 0
      
      for (const fileInfo of fileList) {
        const s3Key = `${s3Prefix}/${folder}/${fileInfo.name}`.replace(/\\/g, '/')

        await uploadFile(fileInfo.path, s3Bucket, s3Key)
        uploaded++
        totalSize += fileInfo.size
        
        if (uploaded % 5 === 0) { // Affichage plus fréquent pour les gros fichiers
          console.log(`Uploadé ${uploaded}/${fileList.length} fichiers du dossier ${folder} (${Math.round(totalSize / 1024 / 1024)} MB total)`)
        }
      }
      console.log(`Dossier ${folder} terminé: ${uploaded} fichiers uploadés (${Math.round(totalSize / 1024 / 1024)} MB total)`)
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(` Le dossier ${folder} n'existe pas, ignoré`)
      } else {
        console.error(` Erreur lors du traitement du dossier ${folder}:`, error)
        throw error
      }
    }
  }

  console.log(' Synchronisation S3 terminée')
}

// FONCTION CORRIGÉE - Utilise des streams pour l'upload S3
async function uploadFile(filePath, bucket, key) {
  try {
    // CORRECTION: Utiliser un stream au lieu de charger tout en mémoire
    const fileStream = fs.createReadStream(filePath)
    
    // Obtenir la taille du fichier pour le progress
    const stat = await fs.promises.stat(filePath)
    
    const params = {
      Bucket: bucket,
      Key: key,
      Body: fileStream, // ← Stream au lieu de Buffer
      ContentLength: stat.size // Optionnel mais recommandé
    }
    
    await s3Client.send(new PutObjectCommand(params))
    console.log(`Uploadé: ${path.basename(filePath)} (${Math.round(stat.size / 1024 / 1024)} MB) -> s3://${bucket}/${key}`)
  } catch (error) {
    console.error(` Erreur lors de l'upload de ${filePath}:`, error)
    throw error
  }
}

async function main() {
  try {
    console.log('=== DÉBUT DU TRAITEMENT COMPLET ===')
    console.log('Suppression du répertoire dist')
    // await removeDirectory(config.localDistPath)

    console.log('Génération des fichiers départementaux')
    await runYarn('dist')

    const distPath = config.localDistPath

    console.log('\n === CRÉATION DES FICHIERS NATIONAUX ===')

    console.log('\n Adresses avec IDs...')
    await createNationalFile(
      path.join(distPath, 'csv-with-ids'),
      /^adresses-with-ids-\d+\.csv\.gz$/,
      path.join(distPath, 'csv-with-ids', 'adresses-with-ids-france.csv.gz'),
      '01'
    )

    console.log('\n Lieux-dits avec IDs...')
    await createNationalFile(
      path.join(distPath, 'csv-with-ids'),
      /^lieux-dits-with-ids-.*\.csv\.gz$/,
      path.join(distPath, 'csv-with-ids', 'lieux-dits-with-ids-beta-france.csv.gz'),
      '01-beta'
    )

    console.log('\n Adresses CSV standard...')
    await createNationalFile(
      path.join(distPath, 'csv'),
      /^adresses-\d+\.csv\.gz$/,
      path.join(distPath, 'csv', 'adresses-france.csv.gz'),
      '01'
    )

    console.log('\n Lieux-dits CSV standard...')
    await createNationalFile(
      path.join(distPath, 'csv'),
      /^lieux-dits-.*\.csv\.gz$/,
      path.join(distPath, 'csv', 'lieux-dits-beta-france.csv.gz'),
      '01-beta'
    )

    console.log('\n Adresses CSV-BAL...')
    await createNationalFile(
      path.join(distPath, 'csv-bal'),
      /^adresses-\d+\.csv\.gz$/,
      path.join(distPath, 'csv-bal', 'adresses-france.csv.gz'),
      '01'
    )

    console.log('\n Fichiers Addok...')
    await mergeAddokFiles(
      path.join(distPath, 'addok'),
      /^adresses.*$/,
      path.join(distPath, 'addok', 'adresses-addok-france.ndjson.gz')
    )

    console.log('\n  === SYNCHRONISATION S3 ===')
    await syncToS3(
      distPath,
      config.s3Bucket,
      config.s3Prefix
    )

    console.log('\n === TOUTES LES TÂCHES COMPLÉTÉES AVEC SUCCÈS ===')
  } catch (error) {
    console.error(' Une erreur est survenue:', error)
    process.exit(1)
  }
}

main().then(() => {
  console.log(' Opération dist-and-upload terminée avec succès')
  process.exit(0)
}).catch(error => {
  console.error(' Erreur pendant l\'opération dist-and-upload:', error)
  process.exit(1)
})