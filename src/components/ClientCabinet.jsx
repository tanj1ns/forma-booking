import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Calendar, CheckCircle2, LogOut, RefreshCw, Scissors, UserCheck, XCircle } from 'lucide-react';
import { BOOKING_STATUS, TIME_SLOTS, formatRub, getMySavedCodes } from '../api.js';
import { formatClientPhone } from '../clientAuth.js';

export default function ClientCabinet({
  client,
  clientAuth,
  masters,
  myBookings,
  dates,
  rescheduleTarget,
  reschedDate,
  reschedTime,
  getSlotAvailability,
  onSetRescheduleTarget,
  onSetReschedDate,
  onSetReschedTime,
  onRescheduleSubmit,
  onCancelBooking,
  onClientChange,
  onBackToBooking,
  onOpenPrivacy
}) {
  const [authTab, setAuthTab] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authMsg, setAuthMsg] = useState({ type: '', text: '' });
  const [authBusy, setAuthBusy] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regFavMaster, setRegFavMaster] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regWebsite, setRegWebsite] = useState('');
  const [regConsent, setRegConsent] = useState(false);
  const regOpenedAt = useRef(Date.now());

  const [profName, setProfName] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profMaster, setProfMaster] = useState('');
  const [profNote, setProfNote] = useState('');
  const [profMsg, setProfMsg] = useState({ type: '', text: '' });
  const [profBusy, setProfBusy] = useState(false);

  useEffect(() => {
    if (authTab === 'register') regOpenedAt.current = Date.now();
  }, [authTab]);

  useEffect(() => {
    if (!client) return;
    setProfName(client.name || '');
    setProfPhone(client.phone || '');
    setProfMaster(client.meta?.favMaster || '');
    setProfNote(client.meta?.note || '');
  }, [client]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthMsg({ type: '', text: '' });
    setAuthBusy(true);
    try {
      const res = await clientAuth.login(loginEmail, loginPassword);
      onClientChange(res.client);
      setLoginPassword('');
    } catch (err) {
      setAuthMsg({ type: 'err', text: err.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAuthMsg({ type: '', text: '' });
    setAuthBusy(true);
    try {
      const res = await clientAuth.register({
        name: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        meta: {
          favMaster: regFavMaster || masters[0]?.name || '',
          note: '',
          bookingCodes: getMySavedCodes()
        },
        consent: regConsent,
        website: regWebsite,
        elapsedMs: Date.now() - regOpenedAt.current
      });
      if (res.client) onClientChange(res.client);
      setRegPassword('');
    } catch (err) {
      setAuthMsg({ type: 'err', text: err.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfMsg({ type: '', text: '' });
    setProfBusy(true);
    try {
      const res = await clientAuth.updateProfile({
        name: profName,
        phone: profPhone,
        meta: { favMaster: profMaster, note: profNote.trim() }
      });
      onClientChange(res.client);
      setProfMsg({ type: 'ok', text: 'Карта гостя обновлена и применяется при новой записи.' });
    } catch (err) {
      setProfMsg({ type: 'err', text: err.message });
    } finally {
      setProfBusy(false);
    }
  }

  async function handleLogout() {
    await clientAuth.logout().catch(() => {});
    onClientChange(null);
  }

  function fillDemoGuest() {
    setAuthTab('login');
    setLoginEmail('client@forma-studio.ru');
    setLoginPassword('client12345');
    setAuthMsg({ type: 'ok', text: 'Подставлены данные демо-гостя' });
  }

  function renderBookingsList() {
    if (myBookings.length === 0) {
      return (
        <div className="panel">
          <p style={{ color: 'var(--text-muted)' }}>
            У вас пока нет активных записей. Выберите услугу и мастера во вкладке записи.
          </p>
          <button type="button" className="btn btn--primary btn--sm" style={{ marginTop: 10 }} onClick={onBackToBooking}>
            Выбрать время визита
          </button>
        </div>
      );
    }
    return (
      <div className="admin-list">
        {myBookings.map((b) => {
          const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
          return (
            <div key={b.code} className="panel my-booking-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <strong className="mono">{b.code}</strong>
                    <span className={`status-pill ${st.cls}`}>{st.label}</span>
                  </div>
                  <h3 style={{ fontSize: '1.08rem', marginTop: 6 }}>
                    {b.serviceName} · <span className="mono">{formatRub(b.price)}</span>
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
                    Мастер: <strong>{b.masterName}</strong> · <span className="mono">{b.date} в {b.time}</span>
                  </p>
                </div>

                {b.status !== 'cancelled' && b.status !== 'completed' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => {
                        onSetRescheduleTarget(b);
                        onSetReschedDate(dates[0].iso);
                        onSetReschedTime('');
                      }}
                    >
                      <RefreshCw size={14} /> Перенести
                    </button>
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => onCancelBooking(b.code)}>
                      <XCircle size={14} /> Отменить
                    </button>
                  </div>
                )}
              </div>

              {rescheduleTarget?.code === b.code && (
                <div className="reschedule-box">
                  <div className="date-strip">
                    {dates.map((d) => (
                      <button
                        key={d.iso}
                        type="button"
                        className={`date-pill ${reschedDate === d.iso ? 'is-active' : ''}`}
                        onClick={() => {
                          onSetReschedDate(d.iso);
                          onSetReschedTime('');
                        }}
                      >
                        <span>{d.short}</span>
                        <small className="mono">{d.sub}</small>
                      </button>
                    ))}
                  </div>
                  <div className="slots-grid" style={{ marginTop: 10 }}>
                    {TIME_SLOTS.map((t) => {
                      const free = getSlotAvailability(reschedDate, t, b.masterId).free;
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={!free}
                          className={`slot-pill ${reschedTime === t ? 'is-active' : ''}`}
                          onClick={() => onSetReschedTime(t)}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={!reschedTime}
                      onClick={onRescheduleSubmit}
                    >
                      Подтвердить перенос
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => onSetRescheduleTarget(null)}>
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Клубная карта гостя</span>
            <h1 className="section-title">
              {client ? `Личный кабинет · ${client.name}` : 'Личный кабинет гостя'}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--outline btn--sm" onClick={onBackToBooking}>
              <ArrowLeft size={14} /> К записи на визит
            </button>
            {client && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
                <LogOut size={14} /> Выйти
              </button>
            )}
          </div>
        </div>

        {!client ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div className="auth-layout">
              <div className="panel">
                <div className="tabs" style={{ marginBottom: 16 }}>
                  <button
                    type="button"
                    className={`tab ${authTab === 'login' ? 'is-active' : ''}`}
                    onClick={() => {
                      setAuthTab('login');
                      setAuthMsg({ type: '', text: '' });
                    }}
                  >
                    Вход
                  </button>
                  <button
                    type="button"
                    className={`tab ${authTab === 'register' ? 'is-active' : ''}`}
                    onClick={() => {
                      setAuthTab('register');
                      setAuthMsg({ type: '', text: '' });
                    }}
                  >
                    Регистрация гостя
                  </button>
                </div>

                {authTab === 'login' ? (
                  <form className="form" onSubmit={handleLogin}>
                    <div className="field">
                      <label htmlFor="frmLoginEmail">Email</label>
                      <input
                        id="frmLoginEmail"
                        type="email"
                        className="input mono"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="client@forma-studio.ru"
                        required
                        autoComplete="email"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="frmLoginPass">Пароль</label>
                      <input
                        id="frmLoginPass"
                        type="password"
                        className="input"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Введите пароль"
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    {authMsg.text && (
                      <p className={`status-msg ${authMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                        {authMsg.text}
                      </p>
                    )}
                    <button type="submit" className="btn btn--primary" disabled={authBusy}>
                      {authBusy ? 'Входим...' : 'Войти'}
                    </button>
                  </form>
                ) : (
                  <form className="form" onSubmit={handleRegister}>
                    <div className="field">
                      <label htmlFor="frmRegName">Ваше имя *</label>
                      <input
                        id="frmRegName"
                        className="input"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Иван Петров"
                        required
                      />
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label htmlFor="frmRegEmail">Email *</label>
                        <input
                          id="frmRegEmail"
                          type="email"
                          className="input mono"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="frmRegPhone">Телефон</label>
                        <input
                          id="frmRegPhone"
                          type="tel"
                          className="input mono"
                          value={regPhone}
                          onChange={(e) => setRegPhone(formatClientPhone(e.target.value))}
                          placeholder="+7 (999) 000-00-00"
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="frmRegMaster">Любимый барбер</label>
                      <select
                        id="frmRegMaster"
                        className="input"
                        value={regFavMaster}
                        onChange={(e) => setRegFavMaster(e.target.value)}
                      >
                        <option value="">Любой мастер</option>
                        {masters.map((m) => (
                          <option key={m.id} value={m.name}>{m.name} ({m.role})</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="frmRegPass">Пароль (от 6 символов) *</label>
                      <input
                        id="frmRegPass"
                        type="password"
                        className="input"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        minLength={6}
                        required
                      />
                    </div>
                    <div className="hp-trap" aria-hidden="true">
                      <label htmlFor="frmRegTrap">Ваш сайт</label>
                      <input
                        id="frmRegTrap"
                        tabIndex={-1}
                        autoComplete="off"
                        value={regWebsite}
                        onChange={(e) => setRegWebsite(e.target.value)}
                      />
                    </div>
                    <label className="consent-check">
                      <input
                        type="checkbox"
                        checked={regConsent}
                        onChange={(e) => setRegConsent(e.target.checked)}
                        required
                      />
                      <span>
                        Согласен(на) на обработку персональных данных (
                        <button type="button" className="link-inline" onClick={onOpenPrivacy}>152-ФЗ</button>)
                      </span>
                    </label>
                    {authMsg.text && (
                      <p className={`status-msg ${authMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                        {authMsg.text}
                      </p>
                    )}
                    <button type="submit" className="btn btn--primary" disabled={authBusy}>
                      {authBusy ? 'Создаём карту гостя...' : 'Зарегистрироваться'}
                    </button>
                  </form>
                )}
              </div>

              <aside className="panel demo-creds">
                <div>
                  <span className="eyebrow">Демо-доступ</span>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', marginBottom: 6 }}>
                    Карта постоянного гостя
                  </h2>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                    Быстрая запись к вашему барберу, сохранённые пожелания к стрижке и управление визитами без звонков.
                  </p>
                </div>
                <div className="demo-creds__box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong>Тестовый гость</strong>
                    <span className="status-pill status--live">ГОСТЬ</span>
                  </div>
                  <div className="mono" style={{ fontSize: '0.82rem' }}>Email: client@forma-studio.ru</div>
                  <div className="mono" style={{ fontSize: '0.82rem', marginBottom: 10 }}>Пароль: client12345</div>
                  <button type="button" className="btn btn--outline btn--sm" onClick={fillDemoGuest}>
                    Подставить данные клиента
                  </button>
                </div>
              </aside>
            </div>

            {myBookings.length > 0 && (
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.45rem', marginBottom: 12 }}>
                  <Calendar size={17} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  Записи с этого устройства
                </h2>
                {renderBookingsList()}
              </div>
            )}
          </div>
        ) : (
          <div className="cab-grid">
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserCheck size={17} /> Карта гостя «ФОРМА»
                </h2>
                <span className="status-pill status--live">КЛИЕНТ</span>
              </div>
              <form className="form" onSubmit={handleProfileSave}>
                <div className="field">
                  <label>Email</label>
                  <input className="input mono" value={client.email} disabled />
                </div>
                <div className="field">
                  <label htmlFor="frmProfName">Имя</label>
                  <input
                    id="frmProfName"
                    className="input"
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="frmProfPhone">Телефон</label>
                  <input
                    id="frmProfPhone"
                    type="tel"
                    className="input mono"
                    value={profPhone}
                    onChange={(e) => setProfPhone(formatClientPhone(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="frmProfMaster">Предпочитаемый мастер</label>
                  <select
                    id="frmProfMaster"
                    className="input"
                    value={profMaster}
                    onChange={(e) => setProfMaster(e.target.value)}
                  >
                    <option value="">Любой свободный мастер</option>
                    {masters.map((m) => (
                      <option key={m.id} value={m.name}>{m.name} · {m.role}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="frmProfNote">Пожелания к визиту</label>
                  <input
                    id="frmProfNote"
                    className="input"
                    value={profNote}
                    onChange={(e) => setProfNote(e.target.value)}
                    placeholder="Классический фейд, эспрессо без сахара"
                  />
                </div>
                {profMsg.text && (
                  <p className={`status-msg ${profMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                    {profMsg.text}
                  </p>
                )}
                <button type="submit" className="btn btn--primary" disabled={profBusy}>
                  {profBusy ? 'Сохраняем...' : 'Сохранить карту гостя'}
                </button>
              </form>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Scissors size={17} /> Мои визиты
                </h2>
                <button type="button" className="btn btn--primary btn--sm" onClick={onBackToBooking}>
                  + Новая запись
                </button>
              </div>
              {renderBookingsList()}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
