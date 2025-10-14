import express, {Request, Response} from 'express';
import { S3 } from '@aws-sdk/client-s3'
import { env } from '@ban/config';
import https from 'https'
import { NodeHttpHandler } from '@smithy/node-http-handler'

const app = express();

const PORT = process.env.PORT || 9000;

const S3_CONFIG_ACCESS_KEY_ID = env.S3.access_key_id;
const S3_CONFIG_SECRET_ACCESS_KEY = env.S3.secret_access_key;
const S3_CONFIG_REGION = env.S3.region;
const S3_CONFIG_ENDPOINT = env.S3.endpoint;

export const bucketName = env.S3.bucketName;
export const maxKeys = env.S3.maxKeys;
export const rootDir = ['bal-api/']

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 300,
})

const clientS3 = new S3({
  credentials: {
    accessKeyId: S3_CONFIG_ACCESS_KEY_ID || 'default-access-key-id',
    secretAccessKey: S3_CONFIG_SECRET_ACCESS_KEY || 'default-secret-key',
  },
  region: S3_CONFIG_REGION || 'default-region',
  endpoint: S3_CONFIG_ENDPOINT || '',
  requestHandler: new NodeHttpHandler({
    httpsAgent: agent,
  }),
})

app.get('/bal/codeInsee/:codeInsee', (req: Request, res: Response) => {
    const { codeInsee } = req.params
    if (!codeInsee) {
        res.status(400).send('code insee manquant.');
    }
    
    // Endpoint to get files from OVH S3
    const params = {
        Bucket: bucketName? bucketName:'qzefqfe',
        MaxKeys: Number(maxKeys) // Adjust the number of items to return
    };
    
    clientS3.listObjectsV2(params, (err: Error, data: any) => {
        if (err) {
            console.log('Request for codeInsee:', err.message);
            return res.status(500).json({ error: err.message });
        }
        res.status(200).json(data.Contents);
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}).on('error', (err: Error) => {
    console.error('Failed to start server:', err);
});
