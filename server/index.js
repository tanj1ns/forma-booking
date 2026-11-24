'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const { initDatabase } = require('./db');
const {
  verifyPassword,
  createSession,
  deleteSession,
  getSessionUser,
  buildCookie
} = require('./auth');
const {
  apiLimiter,
  loginLimiter,
  bookingLimiter,
  applySecurityHeaders,
  verifySameOrigin,
  hardenHttpServer
} = require('./security');

const {
  initClientAccount,
  handleClientApi
} = require('./clientAccount');

const PORT = Number(process.env.PORT) || 4001;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const CLIENT_ACCOUNT_CONFIG = {
  prefix: 'forma',
  ordersTable: null,
  seed: {
    name: 'Иван Петров',
    email: 'client@forma-studio.ru',
    phone: '+7 (926) 310-44-12',
    password: process.env.DEMO_CLIENT_PASSWORD || 'client12345',
    meta: {
      favMaster: 'Артур Волков',
      note: 'Классический фейд, эспрессо без сахара',
      bookingCodes: ['FRM-1042']
    }
  }
};

const db = initDatabase();
initClientAccount(db, CLIENT_ACCOUNT_CONFIG);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function readJson(req, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Размер запроса превышает лимит'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Некорректный JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function getBusySlots() {
  const booked = db
    .prepare("SELECT master_id AS masterId, date, time FROM bookings WHERE status != 'cancelled'")
    .all();
  const blocked = db.prepare('SELECT master_id AS masterId, date, time FROM blocked_slots').all();
  return [...booked, ...blocked];
}

function isSlotBusy(masterId, date, time) {
  const b1 = db
    .prepare("SELECT id FROM bookings WHERE master_id = ? AND date = ? AND time = ? AND status != 'cancelled'")
    .get(masterId, date, time);
  if (b1) return true;
  const b2 = db
    .prepare('SELECT id FROM blocked_slots WHERE master_id = ? AND date = ? AND time = ?')
    .get(masterId, date, time);
  return Boolean(b2);
}

function mapService(r) {
  return {
    id: r.id,
    category: r.category,
    name: r.name,
    description: r.description,
    price: r.price,
    durationMin: r.duration_min,
    sortOrder: r.sort_order
  };
}

function mapMaster(r) {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    experience: r.experience,
    rating: r.rating,
    avatarInitials: r.avatar_initials,
    bio: r.bio
  };
}

function mapBooking(r) {
  return {
    id: r.id,
    code: r.code,
    serviceId: r.service_id,
    serviceName: r.service_name,
    price: r.price,
    durationMin: r.duration_min,
    masterId: r.master_id,
    masterName: r.master_name,
    date: r.date,
    time: r.time,
    clientName: r.client_name,
    clientPhone: r.client_phone,
    comment: r.comment || '',
    status: r.status,
    createdAt: r.created_at
  };
}

async function handleApi(req, res, parsed) {
  const method = req.method;
  const pathname = parsed.pathname;

  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'forma-booking' });
  }

  const rate = apiLimiter(req);
  if (!rate.allowed) {
    return sendJson(res, 429, { ok: false, error: 'Слишком много запросов. Подождите минуту.' }, { 'Retry-After': String(rate.retryAfterSec) });
  }

  if (!verifySameOrigin(req)) {
    return sendJson(res, 403, { ok: false, error: 'Запрос отклонён политикой безопасности источника (CSRF)' });
  }

  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  const user = getSessionUser(db, req);

  if (pathname.startsWith('/api/client/')) {
    return handleClientApi(req, res, parsed, db, CLIENT_ACCOUNT_CONFIG, {
      sendJson,
      readJson,
      loginLimiter,
      isSecure
    });
  }

  if (method === 'GET' && pathname === '/api/bootstrap') {
    const services = db.prepare('SELECT * FROM services ORDER BY sort_order ASC, id ASC').all().map(mapService);
    const masters = db.prepare('SELECT * FROM masters ORDER BY id ASC').all().map(mapMaster);
    return sendJson(res, 200, {
      ok: true,
      services,
      masters,
      busySlots: getBusySlots(),
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null
    });
  }

  if (method === 'GET' && pathname === '/api/my-bookings') {
    const rawCodes = String(parsed.searchParams.get('codes') || '');
    const codes = rawCodes
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^FRM-\d{4}$/.test(s))
      .slice(0, 20);
    if (!codes.length) return sendJson(res, 200, { ok: true, bookings: [] });
    const placeholders = codes.map(() => '?').join(',');
    const rows = db.prepare(`SELECT * FROM bookings WHERE code IN (${placeholders}) ORDER BY id DESC`).all(...codes);
    return sendJson(res, 200, { ok: true, bookings: rows.map(mapBooking) });
  }

  if (method === 'POST' && pathname === '/api/bookings') {
    const bRate = bookingLimiter(req);
    if (!bRate.allowed) {
      return sendJson(res, 429, { ok: false, error: 'Слишком много записей. Попробуйте позже.' }, { 'Retry-After': String(bRate.retryAfterSec) });
    }

    const body = await readJson(req);
    if (String(body.website || '').trim() !== '') {
      return sendJson(res, 201, {
        ok: true,
        booking: { code: `FRM-${Math.floor(1000 + Math.random() * 8999)}` }
      });
    }

    if (!body.consent) {
      return sendJson(res, 400, { ok: false, error: 'Подтвердите согласие на обработку персональных данных (152-ФЗ).' });
    }

    const clientName = String(body.clientName || '').trim().slice(0, 100);
    const clientPhone = String(body.clientPhone || '').trim().slice(0, 32);
    const comment = String(body.comment || '').trim().slice(0, 500);
    const date = String(body.date || '').trim();
    const time = String(body.time || '').trim();
    const serviceId = Number(body.serviceId);

    if (clientName.length < 2 || clientPhone.replace(/\D/g, '').length < 11) {
      return sendJson(res, 400, { ok: false, error: 'Укажите имя и корректный номер телефона (+7)' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return sendJson(res, 400, { ok: false, error: 'Выберите дату и свободное время' });
    }

    const srv = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    if (!srv) return sendJson(res, 400, { ok: false, error: 'Услуга не найдена' });

    const masters = db.prepare('SELECT * FROM masters ORDER BY id ASC').all();
    let chosenMaster = null;
    if (!body.masterId || body.masterId === 'any') {
      chosenMaster = masters.find((m) => !isSlotBusy(m.id, date, time));
      if (!chosenMaster) {
        return sendJson(res, 409, { ok: false, error: 'На выбранное время все мастера заняты. Выберите другой слот.' });
      }
    } else {
      chosenMaster = masters.find((m) => m.id === Number(body.masterId));
      if (!chosenMaster) return sendJson(res, 400, { ok: false, error: 'Мастер не найден' });
      if (isSlotBusy(chosenMaster.id, date, time)) {
        return sendJson(res, 409, { ok: false, error: 'Этот слот уже занят. Выберите другое время.' });
      }
    }

    let code = '';
    for (let i = 0; i < 10; i += 1) {
      const candidate = `FRM-${crypto.randomInt(1000, 9999)}`;
      if (!db.prepare('SELECT id FROM bookings WHERE code = ?').get(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) code = `FRM-${Date.now().toString().slice(-4)}`;

    const info = db
      .prepare(
        `INSERT INTO bookings (
          code, service_id, service_name, price, duration_min,
          master_id, master_name, date, time, client_name, client_phone, comment, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .run(
        code,
        srv.id,
        srv.name,
        srv.price,
        srv.duration_min,
        chosenMaster.id,
        chosenMaster.name,
        date,
        time,
        clientName,
        clientPhone,
        comment,
        new Date().toISOString()
      );

    const created = db.prepare('SELECT * FROM bookings WHERE id = ?').get(Number(info.lastInsertRowid));
    return sendJson(res, 201, { ok: true, booking: mapBooking(created), busySlots: getBusySlots() });
  }

  const clientPatch = pathname.match(/^\/api\/bookings\/(FRM-\d{4})$/);
  if (method === 'PATCH' && clientPatch) {
    const code = clientPatch[1];
    const row = db.prepare('SELECT * FROM bookings WHERE code = ?').get(code);
    if (!row) return sendJson(res, 404, { ok: false, error: 'Запись не найдена' });
    const body = await readJson(req);

    if (body.action === 'cancel') {
      db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(row.id);
    } else if (body.action === 'reschedule') {
      const date = String(body.date || '').trim();
      const time = String(body.time || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
        return sendJson(res, 400, { ok: false, error: 'Некорректные дата или время' });
      }
      if (isSlotBusy(row.master_id, date, time)) {
        return sendJson(res, 409, { ok: false, error: 'Новое время уже занято у этого мастера' });
      }
      db.prepare("UPDATE bookings SET date = ?, time = ?, status = 'pending' WHERE id = ?").run(date, time, row.id);
    }
    const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(row.id);
    return sendJson(res, 200, { ok: true, booking: mapBooking(updated), busySlots: getBusySlots() });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const lRate = loginLimiter(req);
    if (!lRate.allowed) {
      return sendJson(res, 429, { ok: false, error: 'Слишком много попыток входа. Попробуйте через 10 минут.' }, { 'Retry-After': String(lRate.retryAfterSec) });
    }
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      return sendJson(res, 401, { ok: false, error: 'Неверный email или пароль' });
    }
    const token = createSession(db, row.id);
    return sendJson(
      res,
      200,
      { ok: true, user: { id: row.id, name: row.name, email: row.email, role: row.role } },
      { 'Set-Cookie': buildCookie(token, false, isSecure) }
    );
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    if (user && user.token) deleteSession(db, user.token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': buildCookie('', true, isSecure) });
  }

  if (pathname.startsWith('/api/admin/')) {
    if (!user || user.role !== 'admin') {
      return sendJson(res, 401, { ok: false, error: 'Требуется авторизация администратора' });
    }

    if (method === 'GET' && pathname === '/api/admin/overview') {
      const bookings = db.prepare('SELECT * FROM bookings ORDER BY date ASC, time ASC, id DESC').all().map(mapBooking);
      const services = db.prepare('SELECT * FROM services ORDER BY sort_order ASC, id ASC').all().map(mapService);
      const masters = db.prepare('SELECT * FROM masters ORDER BY id ASC').all().map(mapMaster);
      const blockedSlots = db.prepare('SELECT id, master_id AS masterId, date, time, reason FROM blocked_slots').all();
      return sendJson(res, 200, { ok: true, bookings, services, masters, blockedSlots });
    }

    const bMatch = pathname.match(/^\/api\/admin\/bookings\/(\d+)$/);
    if (bMatch && method === 'PATCH') {
      const body = await readJson(req);
      const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!allowed.includes(body.status)) {
        return sendJson(res, 400, { ok: false, error: 'Некорректный статус' });
      }
      db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(body.status, Number(bMatch[1]));
      return sendJson(res, 200, { ok: true });
    }

    if (method === 'POST' && pathname === '/api/admin/blocks/toggle') {
      const body = await readJson(req);
      const masterId = Number(body.masterId);
      const date = String(body.date || '');
      const time = String(body.time || '');
      const existing = db
        .prepare('SELECT id FROM blocked_slots WHERE master_id = ? AND date = ? AND time = ?')
        .get(masterId, date, time);
      if (existing) {
        db.prepare('DELETE FROM blocked_slots WHERE id = ?').run(existing.id);
      } else {
        db.prepare('INSERT INTO blocked_slots (master_id, date, time, reason) VALUES (?, ?, ?, ?)').run(
          masterId,
          date,
          time,
          String(body.reason || 'Слот закрыт мастером').slice(0, 80)
        );
      }
      return sendJson(res, 200, { ok: true, blocked: !existing });
    }

    if (method === 'POST' && pathname === '/api/admin/services') {
      const b = await readJson(req);
      const name = String(b.name || '').trim().slice(0, 100);
      if (!name) return sendJson(res, 400, { ok: false, error: 'Укажите название услуги' });
      db.prepare('INSERT INTO services (category, name, description, price, duration_min, sort_order) VALUES (?, ?, ?, ?, ?, 10)').run(
        String(b.category || 'haircuts'),
        name,
        String(b.description || '').trim().slice(0, 300),
        Math.max(0, Number(b.price) || 0),
        Math.max(15, Number(b.durationMin) || 45)
      );
      return sendJson(res, 201, { ok: true });
    }

    const sMatch = pathname.match(/^\/api\/admin\/services\/(\d+)$/);
    if (sMatch) {
      const id = Number(sMatch[1]);
      if (method === 'PUT') {
        const b = await readJson(req);
        db.prepare('UPDATE services SET category = ?, name = ?, description = ?, price = ?, duration_min = ? WHERE id = ?').run(
          String(b.category || 'haircuts'),
          String(b.name || '').trim().slice(0, 100),
          String(b.description || '').trim().slice(0, 300),
          Math.max(0, Number(b.price) || 0),
          Math.max(15, Number(b.durationMin) || 45),
          id
        );
        return sendJson(res, 200, { ok: true });
      }
      if (method === 'DELETE') {
        db.prepare('DELETE FROM services WHERE id = ?').run(id);
        return sendJson(res, 200, { ok: true });
      }
    }
  }

  return sendJson(res, 404, { ok: false, error: 'API маршрут не найден' });
}

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(res);
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (parsed.pathname.startsWith('/api/')) {
      return await handleApi(req, res, parsed);
    }

    if (fs.existsSync(DIST_DIR)) {
      const safeRel = path.normalize(parsed.pathname.replace(/^\/+/, '')).replace(/^(\.\.[/\\])+/, '');
      const absCandidate = path.resolve(DIST_DIR, safeRel || 'index.html');
      const relToDist = path.relative(DIST_DIR, absCandidate);
      if (
        safeRel &&
        !relToDist.startsWith('..') &&
        !path.isAbsolute(relToDist) &&
        fs.existsSync(absCandidate) &&
        fs.statSync(absCandidate).isFile()
      ) {
        return serveFile(res, absCandidate);
      }
      return serveFile(res, path.join(DIST_DIR, 'index.html'));
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Соберите проект командой: npm run build');
  } catch (err) {
    console.error('[Forma Server Error]', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Внутренняя ошибка сервера' });
  }
});

hardenHttpServer(server);

server.listen(PORT, HOST, () => {
  console.log(`ФОРМА запущена на http://localhost:${PORT}`);
});
