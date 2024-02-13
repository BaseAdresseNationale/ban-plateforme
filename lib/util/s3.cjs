const stream = require('node:stream')
const {S3Client, ListObjectsV2Command} = require('@aws-sdk/client-s3')
const {Upload} = require('@aws-sdk/lib-storage')

const {S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT_URL, S3_BUCKET} = process.env

const initializeS3Client = () => {
  const s3Config = {
    region: S3_REGION,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY
    },
    endpoint: S3_ENDPOINT_URL,
    forcePathStyle: true,
  }

  return new S3Client(s3Config)
}

const uploadFileToS3Stream = key => {
  try {
    const s3Client = initializeS3Client()
    const passThroughStream = new stream.PassThrough()
    const parallelUploads3 = new Upload({
      client: s3Client,
      queueSize: 4,
      leavePartsOnError: false,
      params: {
        Bucket: S3_BUCKET,
        Key: key,
        Body: passThroughStream
      },
    })

    return {
      writeStream: passThroughStream,
      uploadDonePromise: parallelUploads3.done()
    }
  } catch (error) {
    console.error(error)
  }
}

// Create a function to list objects in the S3 bucket with a specific prefix
const listObjects = async prefix => {
  const s3Client = initializeS3Client()
  const listObjectsCommand = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
  })
  return s3Client.send(listObjectsCommand)
}

module.exports = {initializeS3Client, uploadFileToS3Stream, listObjects}
