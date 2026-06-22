/* eslint-disable unicorn/no-process-exit */
require('dotenv').config()
const {S3Client, CopyObjectCommand, ListObjectsV2Command} = require('@aws-sdk/client-s3')

const s3Client = new S3Client({
  region: process.env.S3_CONFIG_REGION,
  endpoint: process.env.S3_CONFIG_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_CONFIG_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_CONFIG_SECRET_ACCESS_KEY,
  }
})

const config = {
  s3Bucket: process.env.S3_CONFIG_BUCKET,
  s3LatestPrefix: 'adresse-data/ban/adresses/latest/',
  s3TodayPrefix: `adresse-data/ban/adresses/${new Date().toISOString().split('T')[0]}/`,
}

async function copyLatestToToday() {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: config.s3Bucket,
      Prefix: config.s3LatestPrefix,
    })
    const {Contents} = await s3Client.send(listCommand)

    if (!Contents || Contents.length === 0) {
      console.log('Aucun fichier trouvé dans latest.')
      return
    }

    for (const {Key} of Contents) {
      const newKey = Key.replace(config.s3LatestPrefix, config.s3TodayPrefix)
      const copyCommand = new CopyObjectCommand({
        Bucket: config.s3Bucket,
        CopySource: `${config.s3Bucket}/${Key}`,
        Key: newKey,
      })
      // eslint-disable-next-line no-await-in-loop
      await s3Client.send(copyCommand)
      console.log(`Copié: ${Key} → ${newKey}`)
    }

    console.log(`Tous les fichiers ont été copiés vers ${config.s3TodayPrefix}`)
  } catch (error) {
    console.error('Erreur lors de la copie des fichiers:', error)
    process.exit(1)
  }
}

copyLatestToToday()
