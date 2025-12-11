import https from 'https'
import express, {Request, Response} from 'express';
import { S3, GetObjectCommand } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { env } from '@ban/config';

const S3_CONFIG_ACCESS_KEY_ID = env.S3.accessKeyId;
const S3_CONFIG_SECRET_ACCESS_KEY = env.S3.secretAccessKey;
const S3_CONFIG_REGION = env.S3.region;
const S3_CONFIG_ENDPOINT = env.S3.endpoint;

const bucketName = env.S3.bucketName || 'your-bucket-name';
const maxKeys = env.S3.maxKeys || '100'; // Adjust the number of items to return

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

const app = express.Router()

app.get('/', (_req: Request, res: Response) => {
    res.send('BAL API is running');
});

app.get('/health', (_req: Request, res: Response) => {
    res.send('OK');
});

// Endpoint to get 'bal-assemblage' metadata-file from S3
app.get('/bal/codeInsee/:codeInsee', (req: Request, res: Response) => {

    const { codeInsee } = req.params
    if (!codeInsee) {
        res.status(400).send('code insee manquant.');
    }

    const params = {
        Bucket: bucketName,
        MaxKeys: Number(maxKeys),
        Prefix: `bal-assemblage/bal-${codeInsee}.csv`,
    };

    clientS3.listObjectsV2(params, (err: Error, data: any) => {
        if (err) {
            console.log('Request for codeInsee:', err.message, err, 'toto');
            return res.status(500).json({ error: err.message });
        }
        res.status(200).json(data.Contents);
    });
});

// Endpoint to get 'bal-assemblage' file from S3
app.get('/download/:codeInsee', async (req: Request, res: Response) => {
  const { codeInsee } = req.params
  if (!codeInsee) {
      res.status(400).send('code insee manquant.');
  }

  const keyName = `bal-assemblage/bal-${codeInsee}.csv`;

  const params = {
    Bucket: bucketName,
    Key: keyName,
  };

  try {
    const command = new GetObjectCommand(params);
    const response = await clientS3.send(command);

    // Stream the response body to the client
    const contentType = response.ContentType ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    if (typeof response.ContentLength !== 'undefined' && response.ContentLength !== null) {
      res.setHeader('Content-Length', String(response.ContentLength));
    }

    // Pipe the S3 stream directly to the response (guard for undefined/non-node streams)
    if (response.Body && typeof (response.Body as any).pipe === 'function') {
      (response.Body as any).pipe(res);
    } else if (response.Body) {
      // Handle async iterable Body (from some AWS SDK runtime shapes)
      try {
        for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
          res.write(Buffer.from(chunk));
        }
        res.end();
      } catch (streamErr) {
        console.error('Error streaming S3 body:', streamErr);
        res.status(500).send('Error streaming file from S3');
      }
    } else {
      res.status(404).send('No body in S3 response');
    }
  } catch (err) {
  const error = (err as string).toString()?.split(':').includes('NoSuchKey') ? 'File not found' : undefined;
  console.error('Error fetching file from S3:', error || err);
  res.status(500).send(`Error fetching file from S3${error ? `: ${error}` : ''}`);
  }
});

export default app;