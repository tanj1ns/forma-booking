const SECRET_ROUTE_SALT = 'forma-route-v1:';
const SECRET_ROUTE_HASH = '202dd1371cc082620c0752b841f1b48a78c45429e8249883edfda2ac0545210f';

const ADMIN_EMAIL = 'admin@forma-studio.ru';
const ADMIN_PASS_SALT = 'forma-adm-v1:';
const ADMIN_PASS_HASH = 'cdb007dd2d0f96bed3cb48925b5b8fb3ddeee2c78b19246c8859cd1012e1aed4';

const STATIC_DB_KEY = 'forma_static_db_v1';
const STATIC_SESSION_KEY = 'forma_static_admin_v1';
const LOGIN_GUARD_KEY = 'forma_login_guard_v1';
const MY_CODES_KEY = 'forma_my_codes_v1';
const LAST_BOOKING_KEY = 'forma_last_booking_ts';

let staticModeFlag = null;

export const TIME_SLOTS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

export const SERVICE_CATEGORIES = [
  { id: 'all', label: 'Все услуги' },
  { id: 'haircuts', label: 'Стрижки' },
  { id: 'beard', label: 'Борода' },
  { id: 'combo', label: 'Комплексы' },
  { id: 'care', label: 'Уход' }
];

export const BOOKING_STATUS = {
  pending: { label: 'Ожидает', cls: 'status--wip' },
  confirmed: { label: 'Подтверждена', cls: 'status--live' },
  completed: { label: 'Завершена', cls: 'status--oss' },
  cancelled: { label: 'Отменена', cls: 'status--err' }
};

export function isStaticHost() {
  if (staticModeFlag !== null) return staticModeFlag;
  return window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
}

export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str || '')));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isSecretAdminHash(hashStr) {
  const clean = String(hashStr || '')
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .trim();
  if (!clean) return false;
  return (await sha256Hex(SECRET_ROUTE_SALT + clean)) === SECRET_ROUTE_HASH;
}

export function resolveAssetUrl(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:|\.\.?\/)/i.test(url)) return url;
  if (url.startsWith('/')) return `.${url}`;
  return url;
}

export function safeHref(url) {
  const s = String(url || '').trim();
  if (!s) return '#';
  return /^(https?:\/\/|mailto:|tel:|#|\.\.?\/|\/(?!\/))/i.test(s) ? s : '#';
}

export function formatRub(val) {
  return `${Math.round(Number(val) || 0).toLocaleString('ru-RU')} ₽`;
}

export function formatPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits[0] === '8' || digits[0] === '7') digits = '7' + digits.slice(1);
  else digits = '7' + digits;
  digits = digits.slice(0, 11);

  let out = '+7';
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length > 4) out += ') ' + digits.slice(4, 7);
  if (digits.length > 7) out += '-' + digits.slice(7, 9);
  if (digits.length > 9) out += '-' + digits.slice(9, 11);
  return out;
}

export function localIsoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getUpcomingDates(days = 7) {
  const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const list = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = localIsoDate(i);
    const short = i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
    const sub = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    list.push({ iso, short, sub });
  }
  return list;
}

export function getMySavedCodes() {
  try {
    const arr = JSON.parse(localStorage.getItem(MY_CODES_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveMyBookingCode(code) {
  const list = getMySavedCodes();
  if (!list.includes(code)) {
    list.unshift(code);
    localStorage.setItem(MY_CODES_KEY, JSON.stringify(list.slice(0, 20)));
  }
}

function getDefaultStaticDb() {
  const today = localIsoDate(0);
  const tomorrow = localIsoDate(1);
  const now = new Date().toISOString();
  return {
    nextId: 10,
    services: [
      { id: 1, category: 'haircuts', name: 'Мужская стрижка', description: 'Мытьё головы, точная стрижка с учётом формы головы, укладка стайлингом.', price: 1800, durationMin: 45 },
      { id: 2, category: 'beard', name: 'Моделирование бороды', description: 'Оформление контуров триммером и опасной бритвой, распаривание полотенцем и масло.', price: 1200, durationMin: 30 },
      { id: 3, category: 'combo', name: 'Стрижка + Борода', description: 'Комплексный уход: стрижка ножницами и машинкой, оформление бороды и укладка.', price: 2700, durationMin: 75 },
      { id: 4, category: 'care', name: 'Камуфляж седины', description: 'Деликатная безаммиачная тонировка волос или бороды на 3–4 недели без эффекта отросших корней.', price: 1400, durationMin: 30 },
      { id: 5, category: 'care', name: 'Уход за кожей головы', description: 'Очищающий пилинг, тонизирующий массаж и охлаждающий компресс после рабочего дня.', price: 1100, durationMin: 25 }
    ],
    masters: [
      { id: 1, name: 'Артур Волков', role: 'Топ-барбер', experience: '7 лет опыта', rating: 4.9, avatarInitials: 'АВ', bio: 'Специализируется на классических формах, текстурных стрижках и подборе образа.' },
      { id: 2, name: 'Максим Громов', role: 'Барбер-стилист', experience: '5 лет опыта', rating: 4.9, avatarInitials: 'МГ', bio: 'Точные фейды, кропы и быстрая укладка без сложного ежедневного ухода.' },
      { id: 3, name: 'Денис Савин', role: 'Мастер по бороде', experience: '4 года опыта', rating: 4.8, avatarInitials: 'ДС', bio: 'Аккуратная геометрия бороды, бритьё горячим полотенцем и камуфляж.' }
    ],
    bookings: [
      { id: 1, code: 'FRM-1042', serviceId: 1, serviceName: 'Мужская стрижка', price: 1800, durationMin: 45, masterId: 1, masterName: 'Артур Волков', date: today, time: '12:00', clientName: 'Иван Петров', clientPhone: '+7 (926) 310-44-12', comment: '', status: 'confirmed', createdAt: now },
      { id: 2, code: 'FRM-1043', serviceId: 3, serviceName: 'Стрижка + Борода', price: 2700, durationMin: 75, masterId: 2, masterName: 'Максим Громов', date: tomorrow, time: '15:00', clientName: 'Егор Лебедев', clientPhone: '+7 (915) 842-19-05', comment: '', status: 'pending', createdAt: now }
    ],
    blockedSlots: [
      { id: 1, masterId: 1, date: today, time: '14:00', reason: 'Обеденный перерыв' }
    ]
  };
}

function loadStaticDb() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATIC_DB_KEY) || 'null');
    if (raw && Array.isArray(raw.services) && Array.isArray(raw.masters)) return raw;
  } catch {
    // ignore
  }
  const fresh = getDefaultStaticDb();
  localStorage.setItem(STATIC_DB_KEY, JSON.stringify(fresh));
  return fresh;
}

function saveStaticDb(db) {
  localStorage.setItem(STATIC_DB_KEY, JSON.stringify(db));
}

function getStaticUser() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATIC_SESSION_KEY) || 'null');
    if (raw && raw.role === 'admin' && raw.expiresAt > Date.now()) {
      return { id: 1, name: raw.name, email: raw.email, role: 'admin' };
    }
  } catch {
    // ignore
  }
  return null;
}

function getBusySlotsFromDb(db) {
  return [
    ...db.bookings.filter((b) => b.status !== 'cancelled').map((b) => ({ masterId: b.masterId, date: b.date, time: b.time })),
    ...db.blockedSlots.map((s) => ({ masterId: s.masterId, date: s.date, time: s.time }))
  ];
}

function isSlotBusyInDb(db, masterId, date, time) {
  return (
    db.bookings.some((b) => b.masterId === masterId && b.date === date && b.time === time && b.status !== 'cancelled') ||
    db.blockedSlots.some((s) => s.masterId === masterId && s.date === date && s.time === time)
  );
}

async function staticApi(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = typeof options.body === 'string' ? JSON.parse(options.body || '{}') : (options.body || {});
  const db = loadStaticDb();
  const user = getStaticUser();

  if (method === 'GET' && url === '/api/bootstrap') {
    return {
      ok: true,
      staticMode: true,
      services: db.services,
      masters: db.masters,
      busySlots: getBusySlotsFromDb(db),
      user
    };
  }

  if (method === 'GET' && url.startsWith('/api/my-bookings')) {
    const qs = url.split('?')[1] || '';
    const params = new URLSearchParams(qs);
    const codes = (params.get('codes') || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const list = db.bookings.filter((b) => codes.includes(b.code));
    return { ok: true, bookings: list };
  }

  if (method === 'POST' && url === '/api/bookings') {
    if (String(body.website || '').trim() !== '') {
      return { ok: true, booking: { code: `FRM-${Math.floor(1000 + Math.random() * 8999)}` } };
    }
    if (!body.consent) {
      throw new Error('Подтвердите согласие на обработку персональных данных (152-ФЗ).');
    }
    const lastTs = Number(localStorage.getItem(LAST_BOOKING_KEY) || 0);
    if (lastTs && Date.now() - lastTs < 30000) {
      throw new Error('Подождите 30 секунд перед следующей записью.');
    }

    const clientName = String(body.clientName || '').trim().slice(0, 100);
    const clientPhone = String(body.clientPhone || '').trim().slice(0, 32);
    const date = String(body.date || '').trim();
    const time = String(body.time || '').trim();
    if (clientName.length < 2 || clientPhone.replace(/\D/g, '').length < 11) {
      throw new Error('Укажите имя и корректный номер телефона (+7)');
    }
    const srv = db.services.find((s) => s.id === Number(body.serviceId));
    if (!srv) throw new Error('Выберите услугу');

    let master = null;
    if (!body.masterId || body.masterId === 'any') {
      master = db.masters.find((m) => !isSlotBusyInDb(db, m.id, date, time));
      if (!master) throw new Error('На выбранное время все мастера заняты.');
    } else {
      master = db.masters.find((m) => m.id === Number(body.masterId));
      if (!master) throw new Error('Мастер не найден');
      if (isSlotBusyInDb(db, master.id, date, time)) throw new Error('Этот слот уже занят.');
    }

    const code = `FRM-${Math.floor(1000 + Math.random() * 8999)}`;
    const created = {
      id: ++db.nextId,
      code,
      serviceId: srv.id,
      serviceName: srv.name,
      price: srv.price,
      durationMin: srv.durationMin,
      masterId: master.id,
      masterName: master.name,
      date,
      time,
      clientName,
      clientPhone,
      comment: String(body.comment || '').trim().slice(0, 500),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    db.bookings.unshift(created);
    saveStaticDb(db);
    localStorage.setItem(LAST_BOOKING_KEY, String(Date.now()));
    return { ok: true, booking: created, busySlots: getBusySlotsFromDb(db) };
  }

  const patchMatch = url.match(/^\/api\/bookings\/(FRM-\d{4})$/);
  if (method === 'PATCH' && patchMatch) {
    const item = db.bookings.find((b) => b.code === patchMatch[1]);
    if (!item) throw new Error('Запись не найдена');
    if (body.action === 'cancel') {
      item.status = 'cancelled';
    } else if (body.action === 'reschedule') {
      const date = String(body.date || '');
      const time = String(body.time || '');
      if (isSlotBusyInDb(db, item.masterId, date, time)) throw new Error('Новое время уже занято.');
      item.date = date;
      item.time = time;
      item.status = 'pending';
    }
    saveStaticDb(db);
    return { ok: true, booking: item, busySlots: getBusySlotsFromDb(db) };
  }

  if (method === 'POST' && url === '/api/auth/login') {
    const now = Date.now();
    let guard = { attempts: 0, firstAt: now, lockedUntil: 0 };
    try {
      const g = JSON.parse(localStorage.getItem(LOGIN_GUARD_KEY) || 'null');
      if (g && typeof g === 'object') guard = g;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 450));
    if (guard.lockedUntil && guard.lockedUntil > now) {
      throw new Error('Слишком много попыток входа. Повторите через несколько минут.');
    }
    if (!guard.firstAt || now - guard.firstAt > 600_000) {
      guard = { attempts: 0, firstAt: now, lockedUntil: 0 };
    }
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const digest = await sha256Hex(ADMIN_PASS_SALT + password);
    if (email !== ADMIN_EMAIL || digest !== ADMIN_PASS_HASH) {
      guard.attempts = (guard.attempts || 0) + 1;
      if (guard.attempts >= 5) guard.lockedUntil = Date.now() + 5 * 60 * 1000;
      localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(guard));
      if (guard.lockedUntil > Date.now()) {
        throw new Error('Слишком много попыток входа. Доступ заблокирован на 5 минут.');
      }
      throw new Error('Неверный email или пароль');
    }
    localStorage.removeItem(LOGIN_GUARD_KEY);
    const session = { name: 'Администратор ФОРМА', email: ADMIN_EMAIL, role: 'admin', expiresAt: Date.now() + 14 * 86400_000 };
    localStorage.setItem(STATIC_SESSION_KEY, JSON.stringify(session));
    return { ok: true, user: { id: 1, name: session.name, email: session.email, role: 'admin' } };
  }

  if (method === 'POST' && url === '/api/auth/logout') {
    localStorage.removeItem(STATIC_SESSION_KEY);
    return { ok: true };
  }

  if (url.startsWith('/api/admin/')) {
    if (!user || user.role !== 'admin') throw new Error('Требуется авторизация администратора');

    if (method === 'GET' && url === '/api/admin/overview') {
      return { ok: true, bookings: db.bookings, services: db.services, masters: db.masters, blockedSlots: db.blockedSlots };
    }
    const admB = url.match(/^\/api\/admin\/bookings\/(\d+)$/);
    if (admB && method === 'PATCH') {
      const b = db.bookings.find((x) => x.id === Number(admB[1]));
      if (b) b.status = body.status;
      saveStaticDb(db);
      return { ok: true };
    }
    if (method === 'POST' && url === '/api/admin/blocks/toggle') {
      const mId = Number(body.masterId);
      const idx = db.blockedSlots.findIndex((s) => s.masterId === mId && s.date === body.date && s.time === body.time);
      if (idx >= 0) db.blockedSlots.splice(idx, 1);
      else db.blockedSlots.push({ id: ++db.nextId, masterId: mId, date: body.date, time: body.time, reason: 'Слот закрыт мастером' });
      saveStaticDb(db);
      return { ok: true, blocked: idx < 0 };
    }
    if (method === 'POST' && url === '/api/admin/services') {
      db.services.push({
        id: ++db.nextId,
        category: body.category || 'haircuts',
        name: String(body.name || '').trim(),
        description: String(body.description || '').trim(),
        price: Number(body.price) || 0,
        durationMin: Number(body.durationMin) || 45
      });
      saveStaticDb(db);
      return { ok: true };
    }
    const admS = url.match(/^\/api\/admin\/services\/(\d+)$/);
    if (admS) {
      const id = Number(admS[1]);
      if (method === 'PUT') {
        const s = db.services.find((x) => x.id === id);
        if (s) Object.assign(s, { category: body.category, name: body.name, description: body.description, price: Number(body.price) || 0, durationMin: Number(body.durationMin) || 45 });
      } else if (method === 'DELETE') {
        db.services = db.services.filter((x) => x.id !== id);
      }
      saveStaticDb(db);
      return { ok: true };
    }
  }

  throw new Error('Маршрут не найден');
}

export async function api(url, options = {}) {
  if (isStaticHost()) {
    staticModeFlag = true;
    return staticApi(url, options);
  }
  const opts = {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  };
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  try {
    const res = await fetch(url, opts);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json') && (res.status === 404 || res.status === 405)) {
      staticModeFlag = true;
      return staticApi(url, options);
    }
    const data = await res.json().catch(() => ({ ok: false, error: 'Ошибка ответа сервера' }));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (err) {
    if (err && err.name === 'TypeError') {
      staticModeFlag = true;
      return staticApi(url, options);
    }
    throw err;
  }
}
