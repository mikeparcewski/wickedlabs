// A tiny static server for the smoke: serves the site root (the repo root, as GitHub Pages does) on 127.0.0.1.
// SMOKE_ROOT serves another copy of the site instead (used to show each check fails on the page it replaces).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(process.env.SMOKE_ROOT ?? join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const PORT = Number(process.env.SMOKE_PORT ?? 4377);
const TYPES = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.css': 'text/css', '.js': 'text/javascript', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8' };

createServer(async (req, res) => {
  let file;
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    file = normalize(join(ROOT, path.endsWith('/') ? path + 'index.html' : path));
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  if (file !== ROOT && !file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`));
