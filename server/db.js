'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./auth');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'forma.db');

function localIsoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      duration_min INTEGER NOT NULL DEFAULT 45,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS masters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      experience TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 4.9,
      avatar_initials TEXT NOT NULL,
      bio TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      service_id INTEGER NOT NULL,
      service_name TEXT NOT NULL,
      price INTEGER NOT NULL,
      duration_min INTEGER NOT NULL,
      master_id INTEGER NOT NULL,
      master_name TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      comment TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      master_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      reason TEXT DEFAULT 'Технический перерыв',
      UNIQUE(master_id, date, time)
    );
  `);

  seed(db);
  return db;
}

function seed(db) {
  const now = new Date().toISOString();

  const DEFAULT_ADMIN_SCRYPT =
    '259894d4a72268f1cfe7d8ed59827bb4:e5ef2288dfa5e1859802d1dedbb5effd6d3c882a02c297b5ac9f856362a6ce93434c17b210f8868892d88b7a39511cf29ce776179f2d2f999ae815376308f0e4';
  const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
  if (userCount === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@forma-studio.ru').trim().toLowerCase();
    const passHash = process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : DEFAULT_ADMIN_SCRYPT;
    db.prepare('INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'Администратор ФОРМА',
      email,
      passHash,
      'admin',
      now
    );
  }

  const srvCount = db.prepare('SELECT COUNT(*) AS cnt FROM services').get().cnt;
  if (srvCount === 0) {
    const stmt = db.prepare(
      'INSERT INTO services (category, name, description, price, duration_min, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run('haircuts', 'Мужская стрижка', 'Мытьё головы, точная стрижка с учётом формы головы, укладка стайлингом.', 1800, 45, 1);
    stmt.run('beard', 'Моделирование бороды', 'Оформление контуров триммером и опасной бритвой, распаривание полотенцем и масло.', 1200, 30, 2);
    stmt.run('combo', 'Стрижка + Борода', 'Комплексный уход: стрижка ножницами и машинкой, оформление бороды и укладка.', 2700, 75, 3);
    stmt.run('care', 'Камуфляж седины', 'Деликатная безаммиачная тонировка волос или бороды на 3–4 недели без эффекта отросших корней.', 1400, 30, 4);
    stmt.run('care', 'Уход за кожей головы', 'Очищающий пилинг, тонизирующий массаж и охлаждающий компресс после рабочего дня.', 1100, 25, 5);
  }

  const mCount = db.prepare('SELECT COUNT(*) AS cnt FROM masters').get().cnt;
  if (mCount === 0) {
    const stmt = db.prepare(
      'INSERT INTO masters (name, role, experience, rating, avatar_initials, bio) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run('Артур Волков', 'Топ-барбер', '7 лет опыта', 4.9, 'АВ', 'Специализируется на классических формах, текстурных стрижках и подборе образа.');
    stmt.run('Максим Громов', 'Барбер-стилист', '5 лет опыта', 4.9, 'МГ', 'Точные фейды, кропы и быстрая укладка без сложного ежедневного ухода.');
    stmt.run('Денис Савин', 'Мастер по бороде', '4 года опыта', 4.8, 'ДС', 'Аккуратная геометрия бороды, бритьё горячим полотенцем и камуфляж.');
  }

  const bCount = db.prepare('SELECT COUNT(*) AS cnt FROM bookings').get().cnt;
  if (bCount === 0) {
    const today = localIsoDate(0);
    const tomorrow = localIsoDate(1);
    const stmt = db.prepare(
      `INSERT INTO bookings (
        code, service_id, service_name, price, duration_min,
        master_id, master_name, date, time, client_name, client_phone, comment, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run('FRM-1042', 1, 'Мужская стрижка', 1800, 45, 1, 'Артур Волков', today, '12:00', 'Иван Петров', '+7 (926) 310-44-12', 'Короткие виски, длина сверху без изменений', 'confirmed', now);
    stmt.run('FRM-1043', 3, 'Стрижка + Борода', 2700, 75, 2, 'Максим Громов', tomorrow, '15:00', 'Егор Лебедев', '+7 (915) 842-19-05', '', 'pending', now);

    db.prepare('INSERT OR IGNORE INTO blocked_slots (master_id, date, time, reason) VALUES (?, ?, ?, ?)').run(
      1,
      today,
      '14:00',
      'Обеденный перерыв'
    );
  }
}

module.exports = { initDatabase, DATA_DIR };
