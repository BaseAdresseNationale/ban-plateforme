import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import rascal from 'rascal';
import express from 'express';
import multer from 'multer';
// import cors from 'cors'

import { env } from '@ban/config';

import { parseBalForBan } from './parseBalForBan.js';

import type { BrokerAsPromised } from 'rascal';

const rabbitConfig = {
  hostname: env.RABBIT.host,
  port: Number(env.RABBIT.port),
  user: env.RABBIT.user,
  password: env.RABBIT.password,
};

const config = {
  vhosts: {
    '/': {
      connection: {
        protocol: 'amqp',
        ...rabbitConfig,
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

const upload = multer({ dest: 'uploads/' });
const app = express();
const port = process.env.PORT || 3000;

let broker: Awaited<ReturnType<typeof BrokerAsPromised.create>>;

app.use(express.json({limit: '20mb'}))
// app.use(cors({origin: true}))

app.get('/', (req, res) => {
  res.send('Welcome to the BAN Core API');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/upload-bal', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');

  try {
    const fileStream = fsSync.createReadStream(req.file.path, { encoding: 'utf8' });
    const json = await parseBalForBan(fileStream);
    await broker.publish('default', json); // publie sur exchange/routingKey par défaut

    console.log('[ban-core-api] Fichier BAL envoyé vers RabbitMQ');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[ban-core-api] Erreur parsing ou publication:', error);
    res.status(500).json({ error: 'Erreur traitement BAL' });
  } finally {
    await fs.unlink(req.file.path);
  }
});

app.post('/send-bal', express.text(), async (req, res) => {
  // get the body from the request
  // Assuming the body is sent as JSON
  const body = req.body;

  try {
    const json = await parseBalForBan(body);
    console.log('JSON result', json);

    // Default Publish on exchange/routingKey
    await broker.publish('default', json); 

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[ban-core-api] Erreur parsing ou publication:', error);
    res.status(500).json({ error: 'Erreur traitement BAL en Body' });
  }
});

app.post('/bal/file', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');

  try {
    const buffer = await fs.readFile(req.file.path, 'utf8');
    const message = {
      id: `bal-${Date.now()}`,
      payload: buffer,
      filename: req.file.originalname,
    };
    await broker.publish('bal.uploaded', message);
    console.log('>>> bal.uploaded', message);
    console.log('[ban-core-api] BAL fichier envoyée');
    res.status(202).json({ status: 'queued', source: 'file' });
  } catch (err) {
    console.error('[ban-core-api] Erreur fichier :', err);
    res.status(500).json({ error: 'Erreur traitement BAL' });
  } finally {
    await fs.unlink(req.file.path);
  }
});

app.post('/bal/text', express.text(), async (req, res) => {
  const body: string = req.body;
  if (!body) return res.status(400).send('No BAL data provided');

  try {
    const message = {
      id: `bal-${Date.now()}`,
      payload: body,
      filename: 'via-text-body.csv',
      type: 'text/csv'
    };
    // TODO AFTER
    await broker.publish('balUploaded', message);
    console.log('[ban-core-api] BAL texte envoyée');
    res.status(202).json({ status: 'queued', source: 'text' });
  } catch (err) {
    console.error('[ban-core-api] Erreur text :', err);
    res.status(500).json({ error: 'Erreur traitement BAL depuis le texte CSV' });
  }
});

interface CogRequest {
  cog: string;
}
app.post('/bal/cog', async (req, res) => {
  const body: CogRequest = req.body;
  if (!body) return res.status(400).send('No BAL data provided');

  try {
    const message = {
      id: `bal-${Date.now()}`,
      payload: body,
      filename: 'via-text-body.csv',
      type: 'application/json'
    };
    // TODO AFTER
    await broker.publish('balUploaded', message);
    console.log('[ban-core-api] BAL COG envoyée');
    res.status(202).json({ status: 'queued', source: 'cog' });
  } catch (err) {
    console.error('[ban-core-api] Erreur COG :', err);
    res.status(500).json({ error: 'Erreur traitement BAL depuis le COG' });
  }
});

app.listen(port, async () => {
  try {
    broker = await rascal.BrokerAsPromised.create(config);
    console.log(`[ban-core-api] API démarrée sur http://localhost:${port} et broker RabbitMQ connecté`);
  } catch (error) {
    console.error('[ban-core-api] Erreur de connexion au broker RabbitMQ:', error);
    // process.exit(1);
  }
});
