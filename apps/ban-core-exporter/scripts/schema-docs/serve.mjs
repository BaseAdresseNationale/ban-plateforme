import {createServer} from 'node:http';
import {readFile, realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = await realpath(fileURLToPath(new URL('../../dist/schema-docs/', import.meta.url)));
const port = Number(process.env.DOCS_PORT ?? 4178);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DOCS_PORT doit être un port entre 1 et 65535.');
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.ndjson': 'application/x-ndjson', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml'};
createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, {Allow: 'GET, HEAD'}).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let filename = path.resolve(root, `.${pathname}`);
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    filename = await realpath(filename);
    if (!filename.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end('Accès refusé');
      return;
    }
    const content = await readFile(filename);
    response.writeHead(200, {'Content-Type': types[path.extname(filename)] ?? 'application/octet-stream', 'Content-Length': content.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Page introuvable');
  }
}).listen(port, '127.0.0.1', () => console.log(`Documentation BAN : http://127.0.0.1:${port}\nCtrl+C pour arrêter.`)).on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Le port ${port} est occupé. Utiliser DOCS_PORT=4179 pnpm run docs:preview.` : error.message);
  process.exitCode = 1;
});
