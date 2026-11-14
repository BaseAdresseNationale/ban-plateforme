import express from 'express';

const app = express.Router();

app.get('/ping', (_req, res) => {
  res.status(200).send('pong');
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
