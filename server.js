'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WEB_ROOT = path.join(ROOT, 'public');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function resolvePath(urlPath) {
  const clean = urlPath.split('?')[0];
  const rel = decodeURIComponent(clean);

  let filePath;
  if (rel === '/' || rel === '') {
    filePath = path.join(WEB_ROOT, 'index.html');
  } else {
    filePath = path.normalize(path.join(WEB_ROOT, rel));
    if (!filePath.startsWith(WEB_ROOT)) return null;

    if (!fs.existsSync(filePath)) {
      filePath = path.normalize(path.join(ROOT, rel));
      if (!filePath.startsWith(ROOT)) return null;
    }
  }

  return filePath;
}

const server = http.createServer((req, res) => {
  const filePath = resolvePath(req.url);

  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';

    const CACHEABLE = new Set(['.jpg', '.jpeg', '.png', '.svg', '.mp3', '.ico']);
    const headers = {
      'Content-Type': type,
      'Content-Length': stat.size
    };
    if (CACHEABLE.has(ext)) {
      headers['Cache-Control'] = 'public, max-age=86400';
    }

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Carlos Wolf · Tangos y Partituras — http://localhost:${PORT}`);
});
