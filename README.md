# ФОРМА — Сервис онлайн-записи для студии и мастеров

Веб-приложение записи к мастерам с живой сеткой свободных слотов, переносом/отменой записи клиентом и закрытым кабинетом администратора (расписание мастеров, блокировка окон, управление услугами).

- **Живое демо (GitHub Pages):** https://tanj1ns.github.io/forma-booking/
- **Стек:** React 19 + Vite 6 + Node.js (`node:http`, `node:sqlite`)

## Запуск локально

```bash
npm install
npm run build
npm start
```

Приложение откроется на `http://localhost:4001`.
Для деплоя в РФ готовы `Dockerfile` и `amvera.yml` (`containerPort: 4001`, `persistenceMount: /data`).
