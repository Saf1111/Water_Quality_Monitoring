import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const demo = process.argv.includes('--demo');
const host = demo ? '127.0.0.1' : process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const password = demo ? randomBytes(10).toString('base64url') : process.env.ADMIN_PASSWORD;
const secureCookie = process.env.COOKIE_SECURE === '1' && !demo;
const configuredOrigin = demo ? '' : process.env.APP_ORIGIN;
if (password && password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');

const categories = ['Water leakage', 'Discoloration or contamination', 'Low water pressure', 'Interrupted supply', 'Other'];
const statuses = ['Received', 'In progress', 'Resolved', 'Closed'];
const now = () => new Date().toISOString();
const sessionDuration = 8 * 60 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();
const path = demo ? ':memory:' : resolve(process.env.DATABASE_PATH || root + '/data/aquawatch.sqlite');
if (!demo) mkdirSync(dirname(path), { recursive: true });
const db = new DatabaseSync(path);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    area TEXT NOT NULL,
    description TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Received',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const insert = db.prepare(`
  INSERT INTO reports (reference, category, area, description, name, email, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
if (demo) {
  const areas = ['North District', 'Riverside', 'Central District', 'West District'];
  const daysAgo = [0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6];
  const issueMix = [0, 1, 0, 2, 3, 0, 1, 2, 0, 4, 1, 0];
  for (const [i, day] of daysAgo.entries()) {
    const date = new Date(Date.now() - day * 86400000).toISOString();
    insert.run(i === 0 ? 'AQ-DEMO0000000000000000' : reference(), categories[issueMix[i % issueMix.length]], areas[i % areas.length],
      'Sample community report for demonstration.', 'Demo resident', 'demo@example.test',
      i < 6 ? statuses[0] : i < 12 ? statuses[1] : statuses[2], date, date);
  }
}

function reference() {
  return 'AQ-' + randomBytes(10).toString('hex').toUpperCase();
}

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function json(res, value, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function body(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') fail(415, 'Send JSON data.');
  if (Number(req.headers['content-length'] || 0) > 12000) fail(413, 'Request is too large.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 12000) {
      req.resume();
      fail(413, 'Request is too large.');
    }
    chunks.push(chunk);
  }
  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail(400, 'Invalid request data.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'Invalid request data.');
  return data;
}

function field(data, key, max, label, min = 1) {
  const value = typeof data[key] === 'string' ? data[key].trim() : '';
  if (value.length < min || value.length > max) fail(400, `${label} must contain ${min}–${max} characters.`);
  return value;
}

function limit(req, key, maximum) {
  const id = key + ':' + req.socket.remoteAddress;
  const time = Date.now();
  const previous = attempts.get(id);
  const record = previous && previous.until > time ? previous : { count: 0, until: time + 600000 };
  if (record.count >= maximum) fail(429, 'Too many requests. Try again in a few minutes.');
  record.count++;
  attempts.set(id, record);
}

function session(req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)aquawatch=([a-f0-9]{64})(?:;|$)/)?.[1];
  return token && sessions.get(token) > Date.now() ? token : null;
}

function cookie(res, token, age) {
  res.setHeader('Set-Cookie', `aquawatch=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookie ? '; Secure' : ''}`);
}

setInterval(() => {
  const time = Date.now();
  for (const [id, record] of attempts) if (record.until <= time) attempts.delete(id);
  for (const [token, expires] of sessions) if (expires <= time) sessions.delete(token);
}, 600000).unref();

const summary = db.prepare('SELECT status, COUNT(*) AS count FROM reports GROUP BY status');
const breakdown = db.prepare('SELECT category, COUNT(*) AS count FROM reports GROUP BY category ORDER BY count DESC, category');
const activity = db.prepare('SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM reports WHERE created_at >= ? GROUP BY date');
const publicReport = db.prepare('SELECT reference, category, status, note, created_at, updated_at FROM reports WHERE reference = ?');
const adminReports = db.prepare('SELECT * FROM reports WHERE id < ? ORDER BY id DESC LIMIT 26');
const updateReport = db.prepare('UPDATE reports SET status = ?, note = ?, updated_at = ? WHERE reference = ?');

function dashboard() {
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10));
  const counts = new Map(activity.all(days[0]).map(({ date, count }) => [date, count]));
  return {
    statuses: summary.all(),
    categories: breakdown.all(),
    activity: days.map(date => ({ date, count: counts.get(date) || 0 })),
    demo,
  };
}

const staticFiles = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/assets/water.webp': ['assets/water.webp', 'image/webp'],
  '/assets/manrope-latin-wght-normal.woff2': ['assets/manrope-latin-wght-normal.woff2', 'font/woff2'],
};

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;
    const { method } = req;
    if (method === 'GET' && Object.hasOwn(staticFiles, pathname)) {
      const [file, type] = staticFiles[pathname];
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      return res.end(readFileSync(resolve(root, 'public', file)));
    }
    if (method !== 'GET') {
      const origin = configuredOrigin || `http://${req.headers.host}`;
      if (req.headers.origin && req.headers.origin !== origin) fail(403, 'Request origin is blocked.');
    }
    if (method === 'GET' && pathname === '/api/summary') return json(res, dashboard());
    if (method === 'POST' && pathname === '/api/reports') {
      limit(req, 'submit', 12);
      const data = await body(req);
      const category = field(data, 'category', 60, 'Issue type');
      if (!categories.includes(category)) fail(400, 'Choose a valid issue type.');
      const area = field(data, 'area', 100, 'Area', 2);
      const description = field(data, 'description', 1500, 'Description', 12);
      const name = field(data, 'name', 100, 'Name', 2);
      const email = field(data, 'email', 254, 'Email');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
      const code = reference();
      const time = now();
      insert.run(code, category, area, description, name, email, 'Received', time, time);
      return json(res, publicReport.get(code), 201);
    }
    const reportMatch = pathname.match(/^\/api\/reports\/(AQ-[A-Z0-9]{20})$/i);
    if (method === 'GET' && reportMatch) {
      limit(req, 'track', 60);
      const report = publicReport.get(reportMatch[1].toUpperCase());
      if (!report) fail(404, 'No report found for that reference.');
      return json(res, report);
    }
    if (pathname === '/api/admin/session') {
      if (method === 'GET') return json(res, { signedIn: !!session(req), enabled: !!password });
      if (method === 'POST') {
        if (!password) fail(503, 'Set ADMIN_PASSWORD on the server to enable staff access.');
        limit(req, 'login', 10);
        const data = await body(req);
        const hash = value => createHash('sha256').update(value).digest();
        if (typeof data.password !== 'string' || !timingSafeEqual(hash(password), hash(data.password))) {
          fail(401, 'Incorrect staff password.');
        }
        const previous = session(req);
        if (previous) sessions.delete(previous);
        const token = randomBytes(32).toString('hex');
        sessions.set(token, Date.now() + sessionDuration);
        cookie(res, token, sessionDuration / 1000);
        return json(res, { signedIn: true });
      }
      if (method === 'DELETE') {
        const token = session(req);
        if (token) sessions.delete(token);
        cookie(res, '', 0);
        return json(res, { signedIn: false });
      }
    }
    if (pathname.startsWith('/api/admin/')) {
      if (!session(req)) fail(401, 'Sign in to use the staff console.');
      if (method === 'GET' && pathname === '/api/admin/reports') {
        const cursor = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
        if (!Number.isSafeInteger(cursor) || cursor < 1) fail(400, 'Invalid report cursor.');
        const rows = adminReports.all(cursor);
        return json(res, { reports: rows.slice(0, 25), next: rows.length === 26 ? rows[24].id : null });
      }
      const match = pathname.match(/^\/api\/admin\/reports\/(AQ-[A-Z0-9]{20})$/i);
      if (method === 'PATCH' && match) {
        const data = await body(req);
        if (!statuses.includes(data.status)) fail(400, 'Choose a valid report status.');
        const note = field(data, 'note', 500, 'Public update', 0);
        const code = match[1].toUpperCase();
        if (!updateReport.run(data.status, note, now(), code).changes) fail(404, 'Report not found.');
        return json(res, publicReport.get(code));
      }
    }
    fail(404, 'Page or endpoint not found.');
  } catch (error) {
    if (!error.status) console.error(error);
    if (!res.headersSent && !res.destroyed) json(res, { error: error.status ? error.message : 'Something went wrong. Try again.' }, error.status || 500);
  }
});

server.listen(port, host, () => {
  console.log(`AquaWatch is ready at http://${host}:${server.address().port}`);
  if (demo) console.log(`Demo staff password: ${password}\nDemo tracking reference: AQ-DEMO0000000000000000`);
});
