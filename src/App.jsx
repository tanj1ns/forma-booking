import React, { useState, useEffect, useMemo } from 'react';
import {
  Scissors,
  Sun,
  Moon,
  Calendar,
  Clock,
  Star,
  CheckCircle2,
  Menu,
  X,
  SlidersHorizontal,
  RefreshCw,
  XCircle
} from 'lucide-react';
import {
  api,
  isStaticHost,
  isSecretAdminHash,
  resolveAssetUrl,
  formatRub,
  formatPhone,
  getUpcomingDates,
  getMySavedCodes,
  saveMyBookingCode,
  TIME_SLOTS,
  SERVICE_CATEGORIES,
  BOOKING_STATUS
} from './api.js';
import PrivacyModal from './components/PrivacyModal.jsx';
import AdminCabin from './pages/AdminCabin.jsx';

export default function App() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const [secretAdminRoute, setSecretAdminRoute] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [view, setView] = useState('book'); // 'book' | 'my'

  const [data, setData] = useState({ services: [], masters: [], busySlots: [], user: null });
  const [loading, setLoading] = useState(true);

  // Booking wizard state
  const [activeCat, setActiveCat] = useState('all');
  const [selectedServiceId, setSelectedServiceId] = useState(1);
  const [selectedMasterId, setSelectedMasterId] = useState('any');
  const dates = useMemo(() => getUpcomingDates(7), []);
  const [selectedDate, setSelectedDate] = useState(() => getUpcomingDates(7)[0].iso);
  const [selectedTime, setSelectedTime] = useState('');

  // Client form state
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [comment, setComment] = useState('');
  const [websiteTrap, setWebsiteTrap] = useState('');
  const [consent, setConsent] = useState(true);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [formOpenedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState({ type: '', text: '' });
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // Client "My bookings" state
  const [myBookings, setMyBookings] = useState([]);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [reschedDate, setReschedDate] = useState(() => getUpcomingDates(7)[0].iso);
  const [reschedTime, setReschedTime] = useState('');

  async function loadBootstrap() {
    const res = await api('/api/bootstrap');
    setData({
      services: res.services || [],
      masters: res.masters || [],
      busySlots: res.busySlots || [],
      user: res.user || null
    });
    if (res.services?.length && !res.services.some((s) => s.id === selectedServiceId)) {
      setSelectedServiceId(res.services[0].id);
    }
    setLoading(false);
  }

  async function loadMyBookings() {
    const codes = getMySavedCodes();
    if (!codes.length) {
      setMyBookings([]);
      return;
    }
    const res = await api(`/api/my-bookings?codes=${encodeURIComponent(codes.join(','))}`);
    setMyBookings(res.bookings || []);
  }

  async function checkSecretHash() {
    setSecretAdminRoute(await isSecretAdminHash(window.location.hash));
  }

  useEffect(() => {
    checkSecretHash();
    loadBootstrap().catch(() => setLoading(false));
    loadMyBookings().catch(() => {});
    const onHash = () => checkSecretHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('forma_theme', next);
  }

  const busySet = useMemo(() => {
    const set = new Set();
    data.busySlots.forEach((s) => set.add(`${s.masterId}|${s.date}|${s.time}`));
    return set;
  }, [data.busySlots]);

  function getSlotAvailability(date, time, masterId) {
    if (masterId === 'any') {
      const freeCount = data.masters.filter((m) => !busySet.has(`${m.id}|${date}|${time}`)).length;
      return { free: freeCount > 0, freeCount };
    }
    const busy = busySet.has(`${Number(masterId)}|${date}|${time}`);
    return { free: !busy, freeCount: busy ? 0 : 1 };
  }

  const visibleServices = useMemo(() => {
    if (activeCat === 'all') return data.services;
    return data.services.filter((s) => s.category === activeCat);
  }, [data.services, activeCat]);

  const selectedService = data.services.find((s) => s.id === selectedServiceId) || data.services[0];
  const selectedMaster = data.masters.find((m) => m.id === Number(selectedMasterId));

  async function handleBookingSubmit(e) {
    e.preventDefault();
    setFormMsg({ type: '', text: '' });

    if (Date.now() - formOpenedAt < 1200) {
      return setFormMsg({ type: 'err', text: 'Пожалуйста, заполните форму вручную.' });
    }
    if (!consent) {
      return setFormMsg({ type: 'err', text: 'Подтвердите согласие на обработку персональных данных (152-ФЗ).' });
    }
    if (!selectedTime) {
      return setFormMsg({ type: 'err', text: 'Выберите свободное время визита.' });
    }
    if (clientName.trim().length < 2 || clientPhone.replace(/\D/g, '').length < 11) {
      return setFormMsg({ type: 'err', text: 'Введите имя и корректный телефон (+7).' });
    }

    setSubmitting(true);
    try {
      const res = await api('/api/bookings', {
        method: 'POST',
        body: {
          serviceId: selectedService.id,
          masterId: selectedMasterId,
          date: selectedDate,
          time: selectedTime,
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          comment: comment.trim(),
          website: websiteTrap,
          consent
        }
      });
      if (res.booking?.code) {
        saveMyBookingCode(res.booking.code);
        setConfirmedBooking(res.booking);
      }
      if (res.busySlots) {
        setData((prev) => ({ ...prev, busySlots: res.busySlots }));
      } else {
        await loadBootstrap();
      }
      await loadMyBookings();
      setSelectedTime('');
      setComment('');
    } catch (err) {
      setFormMsg({ type: 'err', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelBooking(code) {
    try {
      await api(`/api/bookings/${code}`, { method: 'PATCH', body: { action: 'cancel' } });
      await loadBootstrap();
      await loadMyBookings();
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function handleRescheduleSubmit() {
    if (!rescheduleTarget || !reschedTime) return;
    try {
      await api(`/api/bookings/${rescheduleTarget.code}`, {
        method: 'PATCH',
        body: { action: 'reschedule', date: reschedDate, time: reschedTime }
      });
      setRescheduleTarget(null);
      setReschedTime('');
      await loadBootstrap();
      await loadMyBookings();
    } catch (err) {
      window.alert(err.message);
    }
  }

  function exitAdminRoute() {
    if (window.location.hash) {
      window.history.pushState({}, '', window.location.pathname + window.location.search);
    }
    setSecretAdminRoute(false);
  }

  return (
    <>
      <header className="header">
        <div className="container header__inner">
          <a
            href="#top"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              exitAdminRoute();
              setView('book');
            }}
          >
            <span className="brand__icon" aria-hidden="true">
              <Scissors size={16} />
            </span>
            <span>ФОРМА</span>
          </a>

          {!secretAdminRoute && (
            <nav className={`nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Навигация">
              <button
                type="button"
                className={`nav__link ${view === 'book' ? 'is-active' : ''}`}
                onClick={() => {
                  setView('book');
                  setMobileNavOpen(false);
                }}
              >
                Онлайн-запись
              </button>
              <button
                type="button"
                className={`nav__link ${view === 'my' ? 'is-active' : ''}`}
                onClick={() => {
                  setView('my');
                  setMobileNavOpen(false);
                  loadMyBookings().catch(() => {});
                }}
              >
                Мои записи ({myBookings.filter((b) => b.status !== 'cancelled').length})
              </button>
            </nav>
          )}

          <div className="header__right">
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Сменить тему">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {!secretAdminRoute && (
              <button
                type="button"
                className="icon-btn mobile-menu-btn"
                onClick={() => setMobileNavOpen((o) => !o)}
                aria-label="Меню"
              >
                {mobileNavOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
            )}
            {(secretAdminRoute || (!isStaticHost() && data.user)) && (
              <button type="button" className="btn btn--outline btn--sm" onClick={() => exitAdminRoute()}>
                <SlidersHorizontal size={14} /> Запись
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {loading ? (
          <div className="container" style={{ padding: '80px 24px', color: 'var(--text-muted)' }}>Загрузка расписания...</div>
        ) : secretAdminRoute ? (
          <AdminCabin
            user={data.user}
            onAuthChange={async () => {
              await loadBootstrap();
            }}
            onBackHome={exitAdminRoute}
          />
        ) : view === 'my' ? (
          <section className="section">
            <div className="container">
              <div className="section-head">
                <div>
                  <span className="eyebrow">Ваши визиты</span>
                  <h1 className="section-title">Мои записи в студию</h1>
                </div>
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setView('book')}>
                  + Новая запись
                </button>
              </div>

              {myBookings.length === 0 ? (
                <div className="panel">
                  <p style={{ color: 'var(--text-muted)' }}>У вас пока нет активных записей в этом браузере.</p>
                </div>
              ) : (
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
                            <h3 style={{ fontSize: '1.1rem', marginTop: 6 }}>{b.serviceName} · <span className="mono">{formatRub(b.price)}</span></h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
                              Мастер: <strong>{b.masterName}</strong> · <span className="mono">{b.date} в {b.time}</span>
                            </p>
                          </div>

                          {b.status !== 'cancelled' && b.status !== 'completed' && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn--outline btn--sm"
                                onClick={() => {
                                  setRescheduleTarget(b);
                                  setReschedDate(dates[0].iso);
                                  setReschedTime('');
                                }}
                              >
                                <RefreshCw size={14} /> Перенести
                              </button>
                              <button type="button" className="btn btn--danger btn--sm" onClick={() => handleCancelBooking(b.code)}>
                                <XCircle size={14} /> Отменить
                              </button>
                            </div>
                          )}
                        </div>

                        {rescheduleTarget?.code === b.code && (
                          <div className="reschedule-box">
                            <div className="date-strip">
                              {dates.map((d) => (
                                <button key={d.iso} type="button" className={`date-pill ${reschedDate === d.iso ? 'is-active' : ''}`} onClick={() => { setReschedDate(d.iso); setReschedTime(''); }}>
                                  <span>{d.short}</span>
                                  <small className="mono">{d.sub}</small>
                                </button>
                              ))}
                            </div>
                            <div className="slots-grid" style={{ marginTop: 10 }}>
                              {TIME_SLOTS.map((t) => {
                                const free = getSlotAvailability(reschedDate, t, b.masterId).free;
                                return (
                                  <button key={t} type="button" disabled={!free} className={`slot-pill ${reschedTime === t ? 'is-active' : ''}`} onClick={() => setReschedTime(t)}>
                                    {t}
                                  </button>
                                );
                              })}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                              <button type="button" className="btn btn--primary btn--sm" disabled={!reschedTime} onClick={handleRescheduleSubmit}>
                                Подтвердить перенос
                              </button>
                              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRescheduleTarget(null)}>
                                Отмена
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="hero">
              <div className="container hero-grid">
                <div>
                  <span className="eyebrow">Студия мужских стрижек · Москва</span>
                  <h1 className="hero__title">Онлайн-запись к мастеру за 30 секунд</h1>
                  <p className="hero__bio">
                    Живое расписание студии «ФОРМА»: выбирайте услугу, барбера и свободное время без звонков. Перенести или отменить визит можно в два клика.
                  </p>
                  <div className="hero__stats">
                    <div><strong className="mono">4.9 ★</strong><span>Рейтинг мастеров</span></div>
                    <div><strong className="mono">10:00–21:00</strong><span>Без выходных</span></div>
                    <div><strong className="mono">ул. Покровка, 19</strong><span>3 мин от метро</span></div>
                  </div>
                </div>
                <div className="hero-media">
                  <img
                    src={resolveAssetUrl('./uploads/studio-hero.webp')}
                    alt="Интерьер мужской студии ФОРМА"
                    fetchpriority="high"
                    draggable={false}
                  />
                </div>
              </div>
            </section>

            <section className="section">
              <div className="container booking-layout">
                <div className="booking-steps">
                  {/* ШАГ 1: УСЛУГА */}
                  <div className="step-block">
                    <div className="step-head">
                      <span className="step-num mono">01</span>
                      <h2>Выберите услугу</h2>
                    </div>

                    <div className="tabs" style={{ marginBottom: 14 }}>
                      {SERVICE_CATEGORIES.map((c) => (
                        <button key={c.id} type="button" className={`tab ${activeCat === c.id ? 'is-active' : ''}`} onClick={() => setActiveCat(c.id)}>
                          {c.label}
                        </button>
                      ))}
                    </div>

                    <div className="services-list">
                      {visibleServices.map((srv) => (
                        <button
                          key={srv.id}
                          type="button"
                          className={`srv-card ${selectedServiceId === srv.id ? 'is-active' : ''}`}
                          onClick={() => setSelectedServiceId(srv.id)}
                        >
                          <div style={{ textAlign: 'left' }}>
                            <strong>{srv.name}</strong>
                            <p>{srv.description}</p>
                          </div>
                          <div className="srv-card__right">
                            <strong className="mono">{formatRub(srv.price)}</strong>
                            <span className="mono">{srv.durationMin} мин</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ШАГ 2: МАСТЕР */}
                  <div className="step-block">
                    <div className="step-head">
                      <span className="step-num mono">02</span>
                      <h2>Выберите мастера</h2>
                    </div>

                    <div className="masters-grid">
                      <button
                        type="button"
                        className={`master-card ${selectedMasterId === 'any' ? 'is-active' : ''}`}
                        onClick={() => {
                          setSelectedMasterId('any');
                          setSelectedTime('');
                        }}
                      >
                        <span className="master-avatar">★</span>
                        <strong>Любой свободный</strong>
                        <small>Покажем все свободные окна</small>
                      </button>

                      {data.masters.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`master-card ${Number(selectedMasterId) === m.id ? 'is-active' : ''}`}
                          onClick={() => {
                            setSelectedMasterId(m.id);
                            setSelectedTime('');
                          }}
                        >
                          <span className="master-avatar mono">{m.avatarInitials}</span>
                          <strong>{m.name}</strong>
                          <small>{m.role} · {m.experience}</small>
                          <span className="master-rating mono"><Star size={12} fill="currentColor" /> {m.rating}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ШАГ 3: ДАТА И СЛОТЫ */}
                  <div className="step-block">
                    <div className="step-head">
                      <span className="step-num mono">03</span>
                      <h2>Дата и свободное время</h2>
                    </div>

                    <div className="date-strip">
                      {dates.map((d) => (
                        <button
                          key={d.iso}
                          type="button"
                          className={`date-pill ${selectedDate === d.iso ? 'is-active' : ''}`}
                          onClick={() => {
                            setSelectedDate(d.iso);
                            setSelectedTime('');
                          }}
                        >
                          <span>{d.short}</span>
                          <small className="mono">{d.sub}</small>
                        </button>
                      ))}
                    </div>

                    <div className="slots-grid" style={{ marginTop: 14 }}>
                      {TIME_SLOTS.map((t) => {
                        const avail = getSlotAvailability(selectedDate, t, selectedMasterId);
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={!avail.free}
                            className={`slot-pill ${selectedTime === t ? 'is-active' : ''}`}
                            onClick={() => setSelectedTime(t)}
                          >
                            <span className="mono">{t}</span>
                            {selectedMasterId === 'any' && avail.free && (
                              <small>{avail.freeCount} маст.</small>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ПРАВАЯ КОЛОНКА: ИТОГ И ФОРМА */}
                <aside className="summary-card">
                  {confirmedBooking ? (
                    <div className="confirm-box">
                      <CheckCircle2 size={32} color="var(--success)" />
                      <span className="eyebrow">Запись подтверждена</span>
                      <h2 className="mono" style={{ fontSize: '1.5rem' }}>{confirmedBooking.code}</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
                        {confirmedBooking.serviceName} у мастера <strong>{confirmedBooking.masterName}</strong>
                        <br />
                        <span className="mono">{confirmedBooking.date} в {confirmedBooking.time}</span>
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        <button type="button" className="btn btn--primary btn--sm" onClick={() => setView('my')}>
                          Перейти в «Мои записи»
                        </button>
                        <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirmedBooking(null)}>
                          Записать ещё
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form className="form" onSubmit={handleBookingSubmit}>
                      <div>
                        <span className="eyebrow">Ваш визит</span>
                        <h3 style={{ fontSize: '1.15rem', marginTop: 4 }}>{selectedService?.name}</h3>
                        <div className="summary-meta">
                          <span><Clock size={14} /> {selectedService?.durationMin} мин</span>
                          <span className="mono"><Calendar size={14} /> {selectedDate} {selectedTime || '— выберите время'}</span>
                        </div>
                        <div className="summary-master">
                          Мастер: <strong>{selectedMaster ? selectedMaster.name : 'Любой свободный мастер'}</strong>
                        </div>
                        <div className="summary-price mono">{formatRub(selectedService?.price)}</div>
                      </div>

                      <div className="field">
                        <label htmlFor="cName">Ваше имя *</label>
                        <input id="cName" className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Алексей" required />
                      </div>

                      <div className="field">
                        <label htmlFor="cPhone">Телефон *</label>
                        <input
                          id="cPhone"
                          type="tel"
                          className="input mono"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(formatPhone(e.target.value))}
                          placeholder="+7 (999) 123-45-67"
                          required
                        />
                      </div>

                      <div className="field">
                        <label htmlFor="cComment">Пожелание мастеру</label>
                        <input id="cComment" className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: покороче виски" />
                      </div>

                      <div className="hp-trap" aria-hidden="true">
                        <label htmlFor="fWebsite">Ваш сайт</label>
                        <input id="fWebsite" name="website" value={websiteTrap} onChange={(e) => setWebsiteTrap(e.target.value)} tabIndex={-1} autoComplete="off" />
                      </div>

                      <label className="consent-check">
                        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
                        <span>
                          Согласен(на) на обработку персональных данных (
                          <button type="button" className="link-inline" onClick={() => setShowPrivacy(true)}>152-ФЗ</button>
                          )
                        </span>
                      </label>

                      {formMsg.text && <p className={`status-msg ${formMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>{formMsg.text}</p>}

                      <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={submitting}>
                        {submitting ? 'Бронируем слот...' : 'Записаться на это время'}
                      </button>
                    </form>
                  )}
                </aside>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <span>© {new Date().getFullYear()} Студия «ФОРМА» · г. Москва, ул. Покровка, д. 19</span>
          <span>Онлайн-запись · React + Node.js + SQLite</span>
        </div>
      </footer>

      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </>
  );
}
