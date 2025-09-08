
import fs from 'node:fs/promises';
import { BrokerAsPromised } from 'rascal';
import express from 'express';
import multer from 'multer';
import { env } from '@ban/config';

const upload = multer({ dest: 'uploads/' });
const app = express();
const port = process.env.PORT || 3000;
const config = {
  vhosts: {
    '/': {
      connection: {
        protocol: 'amqp',
        hostname: env.RABBIT.host,
        port: Number(env.RABBIT.port),
        user: env.RABBIT.user,
        password: env.RABBIT.password,
      },
      exchanges: [{ name: 'bal.events', type: 'topic' as const }],
      queues: [{ name: 'parser.in', assert: true }],
      bindings: [
        { source: 'bal.events', destination: 'parser.in', bindingKey: 'bal.uploaded' }
      ]
    }
  },
  publications: {
    'balUploaded': {
      exchange: 'bal.events',
      routingKey: 'bal.uploaded'
    }
  }
};

let broker;

app.use(express.text());

app.post('/bal/file', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  const buffer = await fs.readFile(req.file.path, 'utf8');
  await broker.publish('balUploaded', {
    id: `bal-${Date.now()}`,
    payload: buffer,
    filename: req.file.originalname
  });
  await fs.unlink(req.file.path);
  res.status(202).json({ status: 'queued', source: 'file' });
});

app.post('/bal/text', async (req, res) => {
  if (!req.body) return res.status(400).send('No BAL data provided');
  await broker.publish('balUploaded', {
    id: `bal-${Date.now()}`,
    payload: req.body,
    filename: 'via-text-body.csv'
  });
  res.status(202).json({ status: 'queued', source: 'text' });
});

app.listen(port, async () => {
  console.log(`[ban-core-api] API en écoute sur http://localhost:${port}`);
  broker = await BrokerAsPromised.create(config);
});
