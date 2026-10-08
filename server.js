'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const WEB_ROOT = path.join(ROOT, 'public');
const PORT = process.env.PORT || 3000;

// Contraseña del editor: variable de entorno ADMIN_PASSWORD o archivo .password
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  (fs.existsSync(path.join(ROOT, '.password'))
    ? fs.readFileSync(path.join(ROOT, '.password'), 'utf8').trim()
    : '');

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

const CATEGORIAS_VALIDAS = [
  'Caballos',
  'Jockeys y personajes',
  'Studs e instituciones',
  'Carreras y apuestas',
  'Sin clasificar'
];

const SESSION_COOKIE = 'tw_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const LOGIN_MAX_FAILS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const SAVE_MAX_BYTES = 4 * 1024 * 1024;
const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

const sessions = new Set();
const loginFails = new Map(); // ip -> { count, until }

/* ---------- utilidades ---------- */

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        const err = new Error('TOO_LARGE');
        err.code = 'TOO_LARGE';
        req.destroy();
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseJsonBody(buf) {
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

function checkPassword(pw) {
  if (!ADMIN_PASSWORD) return false;
  return crypto.timingSafeEqual(sha256(pw), sha256(ADMIN_PASSWORD));
}

function isAuthed(req) {
  const token = getCookie(req, SESSION_COOKIE);
  return !!(token && sessions.has(token));
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function validateItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return 'estructura inválida';
  const keys = Object.keys(item).sort().join(',');
  if (keys !== 'audio,autor,categorias,descripcion,imagen,titulo') return 'campos inesperados';
  if (typeof item.titulo !== 'string' || !item.titulo.trim() || item.titulo.length > 200) {
    return 'título inválido';
  }
  if (item.autor !== null && (typeof item.autor !== 'string' || item.autor.length > 120)) {
    return 'autor inválido';
  }
  if (typeof item.imagen !== 'string' || !/^imagenes\/[a-z0-9-]+\.(jpg|jpeg|png)$/.test(item.imagen)) {
    return 'ruta de imagen inválida';
  }
  if (
    item.audio !== null &&
    (typeof item.audio !== 'string' || !/^audios\/[a-z0-9-]+\.mp3$/.test(item.audio))
  ) {
    return 'ruta de audio inválida';
  }
  if (typeof item.descripcion !== 'string' || item.descripcion.length > 8000) {
    return 'descripción inválida';
  }
  if (
    !Array.isArray(item.categorias) ||
    item.categorias.length === 0 ||
    item.categorias.some((c) => !CATEGORIAS_VALIDAS.includes(c))
  ) {
    return 'categorías inválidas';
  }
  return null;
}

function validateCatalogo(data) {
  if (!Array.isArray(data)) return { ok: false, error: 'El catálogo debe ser una lista de obras.' };
  if (data.length === 0) return { ok: false, error: 'La lista de obras está vacía.' };
  if (data.length > 500) return { ok: false, error: 'Demasiadas obras.' };
  for (let i = 0; i < data.length; i++) {
    const err = validateItem(data[i]);
    if (err) return { ok: false, error: 'Obra ' + (i + 1) + ' («' + (data[i].titulo || 'sin título') + '»): ' + err + '.' };
  }
  return { ok: true };
}

/* ---------- API ---------- */

async function handleApi(req, res, pathname) {
  const ip = req.socket.remoteAddress || '?';

  if (pathname === '/api/session' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, enabled: !!ADMIN_PASSWORD, authed: isAuthed(req) });
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    if (!ADMIN_PASSWORD) {
      return sendJson(res, 503, { ok: false, error: 'El editor no está habilitado: falta configurar la contraseña en el servidor.' });
    }
    const rec = loginFails.get(ip);
    if (rec && rec.until > Date.now() && rec.count >= LOGIN_MAX_FAILS) {
      return sendJson(res, 429, { ok: false, error: 'Demasiados intentos fallidos. Probá de nuevo más tarde.' });
    }
    let body = null;
    try {
      body = parseJsonBody(await readBody(req, 4096));
    } catch {
      return sendJson(res, 413, { ok: false, error: 'Datos demasiado grandes.' });
    }
    if (!body || !checkPassword(body.password)) {
      const entry = rec && rec.until > Date.now() ? rec : { count: 0, until: Date.now() + LOGIN_WINDOW_MS };
      entry.count += 1;
      loginFails.set(ip, entry);
      return sendJson(res, 401, { ok: false, error: 'Contraseña incorrecta.' });
    }
    loginFails.delete(ip);
    const token = crypto.randomBytes(24).toString('hex');
    sessions.add(token);
    res.setHeader(
      'Set-Cookie',
      SESSION_COOKIE + '=' + token + '; HttpOnly; Path=/; SameSite=Strict; Max-Age=' + SESSION_TTL_SECONDS
    );
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const token = getCookie(req, SESSION_COOKIE);
    if (token) sessions.delete(token);
    res.setHeader('Set-Cookie', SESSION_COOKIE + '=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
    return sendJson(res, 200, { ok: true });
  }

  if (!isAuthed(req)) {
    return sendJson(res, 401, { ok: false, error: 'Sesión no válida. Ingresá de nuevo.' });
  }

  if (pathname === '/api/save' && req.method === 'POST') {
    let data = null;
    try {
      data = parseJsonBody(await readBody(req, SAVE_MAX_BYTES));
    } catch {
      return sendJson(res, 413, { ok: false, error: 'El catálogo es demasiado grande.' });
    }
    if (!data) return sendJson(res, 400, { ok: false, error: 'El JSON recibido no es válido.' });

    const verdict = validateCatalogo(data);
    if (!verdict.ok) return sendJson(res, 400, verdict);

    const jsonPath = path.join(ROOT, 'partituras.json');
    try {
      if (fs.existsSync(jsonPath)) {
        fs.copyFileSync(jsonPath, path.join(ROOT, 'partituras.backup.json'));
      }
      const tmpPath = jsonPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n');
      fs.renameSync(tmpPath, jsonPath);
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: 'No se pudo escribir el archivo en el servidor.' });
    }
    return sendJson(res, 200, { ok: true, count: data.length });
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return sendJson(res, 400, { ok: false, error: 'Pedido inválido.' });
    }
    const rawName = url.searchParams.get('name') || '';
    const ext = path.extname(rawName).toLowerCase();
    const dirByExt = { '.jpg': 'imagenes', '.jpeg': 'imagenes', '.png': 'imagenes', '.mp3': 'audios' };
    const dir = dirByExt[ext];
    if (!dir) {
      return sendJson(res, 400, { ok: false, error: 'Formato no permitido (usá JPG, PNG o MP3).' });
    }
    let buf;
    try {
      buf = await readBody(req, UPLOAD_MAX_BYTES);
    } catch {
      return sendJson(res, 413, { ok: false, error: 'El archivo es demasiado grande (máximo 15 MB).' });
    }
    if (!buf || buf.length === 0) {
      return sendJson(res, 400, { ok: false, error: 'El archivo llegó vacío.' });
    }
    const base = slugify(rawName) || 'archivo';
    let candidate = base + ext;
    let n = 2;
    while (fs.existsSync(path.join(ROOT, dir, candidate))) {
      candidate = base + '-' + n + ext;
      n += 1;
    }
    try {
      fs.writeFileSync(path.join(ROOT, dir, candidate), buf);
    } catch {
      return sendJson(res, 500, { ok: false, error: 'No se pudo guardar el archivo en el servidor.' });
    }
    return sendJson(res, 200, { ok: true, path: dir + '/' + candidate });
  }

  return sendJson(res, 404, { ok: false, error: 'Ruta de API desconocida.' });
}

/* ---------- estático ---------- */

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
  let pathname = '/';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request');
    return;
  }

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch(() => {
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: 'Error interno del servidor.' });
      }
    });
    return;
  }

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
  const editorState = ADMIN_PASSWORD ? 'habilitado' : 'SIN CONTRASEÑA CONFIGURADA (edición deshabilitada)';
  console.log('Carlos Wolf · Tangos y Partituras — http://localhost:' + PORT);
  console.log('Editor: ' + editorState);
});
