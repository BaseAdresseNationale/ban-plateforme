import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import express from 'express';

import { bundleOpenApi } from './openapi.js';

const require = createRequire(import.meta.url);
const swaggerDirectory = path.dirname(require.resolve('swagger-ui-dist/package.json'));
const assets: Record<string, string> = {
  'swagger-ui.css': 'text/css',
  'swagger-ui-bundle.js': 'text/javascript',
};

const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BAN Core API — documentation locale</title>
  <link rel="stylesheet" href="/assets/swagger-ui.css">
</head>
<body>
  <p id="documentation-error" role="alert" hidden></p>
  <div id="swagger-ui"></div>
  <script src="/assets/swagger-ui-bundle.js"></script>
  <script src="/preview.js"></script>
</body>
</html>`;

const browserScript = `
let previousDocument;
let loading = false;
async function refreshDocumentation() {
  if (loading) return;
  loading = true;
  const error = document.getElementById('documentation-error');
  const viewer = document.getElementById('swagger-ui');
  try {
    const response = await fetch('/openapi.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('OpenAPI invalide ou indisponible. Lancer docs:check pour les détails.');
    const spec = await response.json();
    const serialized = JSON.stringify(spec);
    if (serialized !== previousDocument) {
      SwaggerUIBundle({
        spec, dom_id: '#swagger-ui', deepLinking: true,
        validatorUrl: null, supportedSubmitMethods: [], persistAuthorization: false,
      });
      previousDocument = serialized;
    }
    error.hidden = true;
    viewer.hidden = false;
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
    viewer.hidden = true;
  } finally {
    loading = false;
  }
}
refreshDocumentation();
setInterval(refreshDocumentation, 2000);
`;

// Un serveur documentaire indépendant : aucun import de l'application métier,
// de dotenv ou d'un client de service. Les YAML sont relus à chaque consultation.
export function createDocumentationApp(loadDocument = bundleOpenApi) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.set('Allow', 'GET, HEAD').sendStatus(405);
      return;
    }
    next();
  });
  app.get('/', (_req, res) => { res.type('html').send(html); });
  app.get('/preview.js', (_req, res) => { res.type('text/javascript').send(browserScript); });
  app.get('/assets/:asset', (req, res) => {
    const asset = req.params.asset;
    if (typeof asset !== 'string' || !Object.hasOwn(assets, asset)) {
      res.sendStatus(404);
      return;
    }
    res.type(assets[asset]).sendFile(path.join(swaggerDirectory, asset));
  });
  app.get('/openapi.json', async (_req, res) => {
    try {
      res.json(await loadDocument());
    } catch {
      // Ne pas servir silencieusement un ancien contrat si le YAML est invalide.
      res.status(503).json({ error: 'OpenAPI invalide ou indisponible. Lancer docs:check.' });
    }
  });
  return app;
}

export function parseDocumentationPort(args: string[]) {
  if (args.length === 0) return 0;
  if (args.length !== 2 || args[0] !== '--port' || !/^\d+$/.test(args[1])) {
    throw new Error('Usage : docs:dev [--port 0..65535]');
  }
  const port = Number(args[1]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port invalide');
  return port;
}

async function main() {
  const port = parseDocumentationPort(process.argv.slice(2));
  await bundleOpenApi();
  const server = createDocumentationApp().listen(port, '127.0.0.1', () => {
    const address = server.address();
    if (address && typeof address !== 'string') {
      console.log(`Documentation locale : http://127.0.0.1:${address.port}`);
      console.log('Lecture seule ; actualisation des YAML toutes les 2 secondes. Ctrl+C pour arrêter.');
    }
  });
  server.on('error', error => {
    console.error(`Échec du serveur documentaire : ${error.message}`);
    process.exitCode = 1;
  });
  const stop = () => {
    server.close();
    server.closeAllConnections();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Échec de la documentation');
    process.exitCode = 1;
  });
}
