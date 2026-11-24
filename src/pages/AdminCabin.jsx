import React, { useState, useEffect } from 'react';
import { ArrowLeft, LogOut, Plus, Trash2, Lock, Unlock, CheckCircle2 } from 'lucide-react';
import { api, TIME_SLOTS, SERVICE_CATEGORIES, BOOKING_STATUS, formatRub, getUpcomingDates } from '../api.js';

export default function AdminCabin({ user, onAuthChange, onBackHome }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState('schedule');
  const [overview, setOverview] = useState({ bookings: [], services: [], masters: [], blockedSlots: [] });
  const [selectedDate, setSelectedDate] = useState(() => getUpcomingDates(7)[0].iso);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [newSrv, setNewSrv] = useState({ category: 'haircuts', name: '', description: '', price: 1500, durationMin: 45 });

  const dates = getUpcomingDates(7);

  async function loadOverview() {
    const res = await api('/api/admin/overview');
    setOverview({
      bookings: res.bookings || [],
      services: res.services || [],
      masters: res.masters || [],
      blockedSlots: res.blockedSlots || []
    });
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      loadOverview().catch((e) => setMsg({ type: 'err', text: e.message }));
    }
  }, [user]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setLoginErr('');
    try {
      const res = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      onAuthChange(res.user, true);
    } catch (err) {
      setLoginErr(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await api('/api/auth/logout', { method: 'POST' });
    onAuthChange(null, true);
  }

  async function handleStatusChange(bookingId, status) {
    try {
      await api(`/api/admin/bookings/${bookingId}`, { method: 'PATCH', body: { status } });
      await loadOverview();
      onAuthChange(user, true);
      setMsg({ type: 'ok', text: 'Статус записи обновлён' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  async function handleToggleBlock(masterId, time) {
    try {
      await api('/api/admin/blocks/toggle', {
        method: 'POST',
        body: { masterId, date: selectedDate, time }
      });
      await loadOverview();
      onAuthChange(user, true);
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  async function handleAddService(e) {
    e.preventDefault();
    try {
      await api('/api/admin/services', { method: 'POST', body: newSrv });
      setNewSrv({ category: 'haircuts', name: '', description: '', price: 1500, durationMin: 45 });
      await loadOverview();
      onAuthChange(user, true);
      setMsg({ type: 'ok', text: 'Услуга добавлена в прайс' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  async function handleDeleteService(id) {
    try {
      await api(`/api/admin/services/${id}`, { method: 'DELETE' });
      await loadOverview();
      onAuthChange(user, true);
      setMsg({ type: 'ok', text: 'Услуга удалена' });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="container admin-wrap">
        <div className="admin-login">
          <div>
            <span className="eyebrow">Закрытый доступ</span>
            <h1 style={{ fontSize: '1.4rem', marginBottom: 6 }}>Кабинет студии «ФОРМА»</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Управление расписанием мастеров, подтверждение записей и редактирование услуг.
            </p>
          </div>
          <form className="form" onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="fAdmEmail">Email</label>
              <input id="fAdmEmail" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email администратора" required />
            </div>
            <div className="field">
              <label htmlFor="fAdmPass">Пароль</label>
              <input id="fAdmPass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {loginErr && <p className="status-msg status-msg--err">{loginErr}</p>}
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Входим...' : 'Войти в кабинет'}
            </button>
          </form>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onBackHome}>
              <ArrowLeft size={14} /> К онлайн-записи
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container admin-wrap">
      <div className="admin-header">
        <div>
          <span className="eyebrow">CRM студии</span>
          <h1 style={{ fontSize: '1.55rem' }}>Расписание и заявки «ФОРМА»</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn--outline btn--sm" onClick={onBackHome}>
            <ArrowLeft size={14} /> На сайт
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
            <LogOut size={14} /> Выйти
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <button type="button" className={`tab ${tab === 'schedule' ? 'is-active' : ''}`} onClick={() => setTab('schedule')}>
          Сетка расписания
        </button>
        <button type="button" className={`tab ${tab === 'bookings' ? 'is-active' : ''}`} onClick={() => setTab('bookings')}>
          Заявки ({overview.bookings.length})
        </button>
        <button type="button" className={`tab ${tab === 'services' ? 'is-active' : ''}`} onClick={() => setTab('services')}>
          Услуги ({overview.services.length})
        </button>
      </div>

      {msg.text && <p className={`status-msg ${msg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`} style={{ marginBottom: 14 }}>{msg.text}</p>}

      {tab === 'schedule' && (
        <div className="panel">
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.08rem', marginBottom: 10 }}>Свободные и заблокированные окна по мастерам</h2>
            <div className="date-strip">
              {dates.map((d) => (
                <button key={d.iso} type="button" className={`date-pill ${selectedDate === d.iso ? 'is-active' : ''}`} onClick={() => setSelectedDate(d.iso)}>
                  <span>{d.short}</span>
                  <small className="mono">{d.sub}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="matrix-wrap">
            {overview.masters.map((m) => (
              <div key={m.id} className="matrix-row">
                <div className="matrix-row__head">
                  <strong>{m.name}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>{m.role}</span>
                </div>
                <div className="slots-grid">
                  {TIME_SLOTS.map((t) => {
                    const booking = overview.bookings.find((b) => b.masterId === m.id && b.date === selectedDate && b.time === t && b.status !== 'cancelled');
                    const isBlocked = overview.blockedSlots.some((s) => s.masterId === m.id && s.date === selectedDate && s.time === t);
                    if (booking) {
                      return (
                        <div key={t} className="slot-btn is-booked" title={`${booking.clientName} · ${booking.serviceName}`}>
                          <span className="mono">{t}</span>
                          <small>{booking.clientName.split(' ')[0]}</small>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`slot-btn ${isBlocked ? 'is-blocked' : ''}`}
                        onClick={() => handleToggleBlock(m.id, t)}
                        title={isBlocked ? 'Разблокировать окно' : 'Закрыть окно для записи'}
                      >
                        <span className="mono">{t}</span>
                        <small style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {isBlocked ? <><Lock size={11} /> Закрыто</> : <><Unlock size={11} /> Свободно</>}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'bookings' && (
        <div className="panel admin-list">
          {overview.bookings.map((b) => {
            const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
            return (
              <div key={b.id} className="admin-row">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <strong className="mono">{b.code}</strong>
                    <span>{b.clientName} · <span className="mono">{b.clientPhone}</span></span>
                    <span className={`status-pill ${st.cls}`}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {b.serviceName} ({formatRub(b.price)}) · Мастер: {b.masterName} · <span className="mono">{b.date} в {b.time}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => handleStatusChange(b.id, 'confirmed')}>
                    <CheckCircle2 size={13} /> Подтвердить
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleStatusChange(b.id, 'completed')}>
                    Завершена
                  </button>
                  <button type="button" className="btn btn--danger btn--sm" onClick={() => handleStatusChange(b.id, 'cancelled')}>
                    Отменить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'services' && (
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <form className="form-grid" onSubmit={handleAddService}>
            <div className="field">
              <label>Название услуги</label>
              <input className="input" value={newSrv.name} onChange={(e) => setNewSrv({ ...newSrv, name: e.target.value })} placeholder="Например: Детская стрижка" required />
            </div>
            <div className="field">
              <label>Категория</label>
              <select className="input" value={newSrv.category} onChange={(e) => setNewSrv({ ...newSrv, category: e.target.value })}>
                {SERVICE_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Цена (₽)</label>
              <input type="number" className="input" value={newSrv.price} onChange={(e) => setNewSrv({ ...newSrv, price: e.target.value })} required />
            </div>
            <div className="field">
              <label>Длительность (мин)</label>
              <input type="number" className="input" value={newSrv.durationMin} onChange={(e) => setNewSrv({ ...newSrv, durationMin: e.target.value })} required />
            </div>
            <div className="field full">
              <label>Описание</label>
              <input className="input" value={newSrv.description} onChange={(e) => setNewSrv({ ...newSrv, description: e.target.value })} placeholder="Короткое описание процедуры" />
            </div>
            <div className="full">
              <button type="submit" className="btn btn--primary btn--sm"><Plus size={14} /> Добавить услугу</button>
            </div>
          </form>

          <div className="admin-list">
            {overview.services.map((s) => (
              <div key={s.id} className="admin-row">
                <div>
                  <strong>{s.name}</strong>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    <span className="mono">{formatRub(s.price)}</span> · {s.durationMin} мин · {s.description}
                  </div>
                </div>
                <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDeleteService(s.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
