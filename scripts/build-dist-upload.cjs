/* eslint-disable unicorn/no-process-exit */
/* eslint-disable no-await-in-loop */
import spawn from 'node:child_process'

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const util = require('util')
const stream = require('stream')
const {S3Client, PutObjectCommand} = require('@aws-sdk/client-s3')

const pipeline = util.promisify(stream.pipeline)
const readdir = util.promisify(fs.readdir)

// Configuration
const config = {
  localDistPath: path.resolve(__dirname, 'dist'),
  s3Bucket: 'ban-migration',
  s3Prefix: 'prd-ign-mut-ban/adresse-data/ban/adresses/latest'
}

// Client S3
const s3Client = new S3Client({
  region: 'eu-west-3', // Ajustez selon votre région AWS
})

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

  // Identifier le premier fichier pour l'en-tête
  const headerFile = sourceFiles.find(file => file.includes(firstFileDept)) || sourceFiles[0]
  const headerPath = path.join(sourceDir, headerFile)

  // Créer le fichier de sortie avec l'en-tête
  const headerContent = await getFileHeader(headerPath)
  await fs.promises.writeFile(tempOutputPath, headerContent)

  // Traiter chaque fichier et l'ajouter au fichier de sortie
  for (const file of sourceFiles) {
    const filePath = path.join(sourceDir, file)

    await appendFileWithoutHeader(filePath, tempOutputPath)
    console.log(`Traité: ${file}`)
  }

  // Compresser le fichier final
  const gzipOutput = zlib.createGzip()
  const input = fs.createReadStream(tempOutputPath)
  const output = fs.createWriteStream(outputPath)
  await pipeline(input, gzipOutput, output)

  // Supprimer le fichier temporaire
  await fs.promises.unlink(tempOutputPath)
  console.log(`Fichier national créé: ${outputPath}`)
}

async function getFileHeader(filePath) {
  return new Promise((resolve, reject) => {
    const gunzip = zlib.createGunzip()
    const fileStream = fs.createReadStream(filePath)
    let header = Buffer.from('')
    let isFirstLine = true

    fileStream.pipe(gunzip)
      .on('data', chunk => {
        if (isFirstLine) {
          const data = chunk.toString()
          const newlineIndex = data.indexOf('\n')

          // eslint-disable-next-line no-negated-condition
          if (newlineIndex !== -1) {
            header = Buffer.from(data.slice(0, newlineIndex + 1))
            isFirstLine = false
            fileStream.destroy()
          } else {
            header = chunk
          }
        }
      })
      .on('end', () => resolve(header))
      .on('error', reject)
  })
}

async function appendFileWithoutHeader(filePath, outputPath) {
  return new Promise((resolve, reject) => {
    const gunzip = zlib.createGunzip()
    const fileStream = fs.createReadStream(filePath)
    const outputStream = fs.createWriteStream(outputPath, {flags: 'a'})
    let isFirstLine = true

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
        outputStream.end()
        resolve()
      })
      .on('error', reject)
  })
}

async function mergeAddokFiles(sourceDir, filePattern, outputPath) {
  console.log(`Création du fichier addok: ${outputPath}`)

  const files = await readdir(sourceDir)
  const sourceFiles = files.filter(file => file.match(filePattern))

  if (sourceFiles.length === 0) {
    throw new Error(`Aucun fichier trouvé avec le motif: ${filePattern}`)
  }

  const output = fs.createWriteStream(outputPath)

  for (const file of sourceFiles) {
    const filePath = path.join(sourceDir, file)
    const content = await fs.promises.readFile(filePath)
    output.write(content)
    console.log(`Ajouté au fichier addok: ${file}`)
  }

  output.end()
  console.log(`Fichier addok créé: ${outputPath}`)
}

async function syncToS3(localPath, s3Bucket, s3Prefix) {
  console.log(`Synchronisation vers S3: ${s3Bucket}/${s3Prefix}`)

  const folders = ['csv', 'addok', 'csv-bal', 'csv-with-ids', 'csv-bal-with-lang']

  // Parcourir chaque dossier requis
  for (const folder of folders) {
    const folderPath = path.join(localPath, folder)

    try {
      // Vérifier si le dossier existe
      await fs.promises.access(folderPath, fs.constants.R_OK)

      // Lister les fichiers du dossier
      const files = await readdir(folderPath)

      // Upload de chaque fichier
      for (const file of files) {
        const filePath = path.join(folderPath, file)
        const s3Key = `${s3Prefix}/${folder}/${file}`.replace(/\\/g, '/')

        // Vérifier que c'est bien un fichier
        const stat = await fs.promises.stat(filePath)
        if (stat.isFile()) {
          await uploadFile(filePath, s3Bucket, s3Key)
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`Le dossier ${folder} n'existe pas, ignoré`)
      } else {
        throw error
      }
    }
  }

  console.log('Synchronisation S3 terminée')
}

async function uploadFile(filePath, bucket, key) {
  const fileContent = await fs.promises.readFile(filePath)

  const params = {
    Bucket: bucket,
    Key: key,
    Body: fileContent
  }
  try {
    await s3Client.send(new PutObjectCommand(params))
    console.log(`Uploadé: ${filePath} -> s3://${bucket}/${key}`)
  } catch (error) {
    console.error(`Erreur lors de l'upload de ${filePath}:`, error)
    throw error
  }
}

async function main() {
  try {
    // 1. Supprimer le répertoire dist
    console.log('Suppression du répertoire dist')
    await removeDirectory(config.localDistPath)

    // 2. Génération des fichiers départementaux avec yarn
    console.log('Génération des fichiers départementaux')
    await runYarn('dist')

    // 3. Création des fichiers CSV nationaux
    const distPath = config.localDistPath

    // 3.1 Fichier CSV national with ids (legacy)
    await createNationalFile(
      path.join(distPath, 'csv-with-ids'),
      /^adresses-with-ids-\d+\.csv\.gz$/,
      path.join(distPath, 'csv-with-ids', 'adresses-with-ids-france.csv.gz'),
      '01'
    )

    // 3.2 Fichier CSV national des lieux-dits with ids (legacy)
    await createNationalFile(
      path.join(distPath, 'csv-with-ids'),
      /^lieux-dits-with-ids-.*\.csv\.gz$/,
      path.join(distPath, 'csv-with-ids', 'lieux-dits-with-ids-beta-france.csv.gz'),
      '01-beta'
    )

    // 3.3 Fichier CSV national (legacy)
    await createNationalFile(
      path.join(distPath, 'csv'),
      /^adresses-\d+\.csv\.gz$/,
      path.join(distPath, 'csv', 'adresses-france.csv.gz'),
      '01'
    )

    // 3.4 Fichier CSV national des lieux-dits (legacy)
    await createNationalFile(
      path.join(distPath, 'csv'),
      /^lieux-dits-.*\.csv\.gz$/,
      path.join(distPath, 'csv', 'lieux-dits-beta-france.csv.gz'),
      '01-beta'
    )

    // 3.5 Fichier CSV national (BAL)
    await createNationalFile(
      path.join(distPath, 'csv-bal'),
      /^adresses-\d+\.csv\.gz$/,
      path.join(distPath, 'csv-bal', 'adresses-france.csv.gz'),
      '01'
    )

    // 4. Création du fichier national JSON/addok
    await mergeAddokFiles(
      path.join(distPath, 'addok'),
      /^adresses.*$/,
      path.join(distPath, 'addok', 'adresses-addok-france.ndjson.gz')
    )

    // 5. Synchronisation directe vers S3 (sans passer par /mnt/data1)
    await syncToS3(
      distPath,
      config.s3Bucket,
      config.s3Prefix
    )

    console.log('Toutes les tâches ont été complétées avec succès')
  } catch (error) {
    console.error('Une erreur est survenue:', error)
    process.exit(1)
  }
}

main().then(() => {
  console.log('Opération dist-and-upload terminée avec succès')
  process.exit(0)
}).catch(error => {
  console.error('Erreur pendant l\'opération dist-and-upload:', error)
  process.exit(1)
})
