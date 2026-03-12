'use client';

import { useEffect, useState, useMemo } from 'react';
import CrmNav from '../../../components/CrmNav';

type Lead = {
  id: string;
  company_name: string;
  category: string | null;
  zip: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  status: string | null;
  next_follow_up: string | null;
  notes: string | null;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Not Contacted':   { bg: '#f3f4f6', text: '#6b7280', dot: 'var(--status-gray)' },
  'Email 1 Sent':    { bg: 'var(--info-bg)', text: 'var(--info-text)', dot: 'var(--status-blue)' },
  'Email 2 Sent':    { bg: '#eef2ff', text: '#4338ca', dot: 'var(--status-indigo)' },
  'Email 3 Sent':    { bg: '#fff7ed', text: '#c2410c', dot: 'var(--status-orange)' },
  'Replied':         { bg: 'var(--success-bg)', text: 'var(--success-text)', dot: 'var(--status-green)' },
  'Not Fit':         { bg: '#fef2f2', text: '#b91c1c', dot: 'var(--status-red)' },
  'Do Not Contact':  { bg: '#f9fafb', text: '#374151', dot: 'var(--status-dark)' },
};

const NEXT_ACTION: Record<string, string> = {
  'Not Contacted':  'Send Email 1',
  'Email 1 Sent':   'Send Email 2',
  'Email 2 Sent':   'Send Email 3',
  'Email 3 Sent':   'Follow up',
};

function getStatusStyle(status: string | null) {
  return STATUS_COLORS[status || ''] || STATUS_COLORS['Not Contacted'];
}

function toDateKey(dateStr: string): string {
  return dateStr.split('T')[0];
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

type ActivityByDate = {
  emailsByDate: Record<string, { email1: number; email2: number; email3: number; total: number }>;
  leadsImportedByDate: Record<string, number>;
};

export default function CalendarPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [fetchError, setFetchError] = useState('');
  const [fetching, setFetching] = useState(false);
  const [activity, setActivity] = useState<ActivityByDate>({ emailsByDate: {}, leadsImportedByDate: {} });

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/login', { method: 'GET' })
      .then(r => { if (r.ok) setAuthed(true); })
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!authed) return;
    setFetching(true);
    setFetchError('');
    Promise.all([
      fetch('/api/leads').then(r => r.json()),
      fetch('/api/activity').then(r => r.json()),
    ])
      .then(([leadsData, activityData]) => {
        if (leadsData.error) throw new Error(leadsData.error);
        setLeads(leadsData.leads || []);
        setActivity(activityData);
      })
      .catch(e => setFetchError(e.message))
      .finally(() => setFetching(false));
  }, [authed]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setNotice('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) throw new Error('Invalid password');
      setAuthed(true);
      setPassword('');
    } catch (err: any) {
      setNotice(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const leadsByDate = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const lead of leads) {
      if (!lead.next_follow_up) continue;
      const key = toDateKey(lead.next_follow_up);
      if (!map[key]) map[key] = [];
      map[key].push(lead);
    }
    return map;
  }, [leads]);

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  function prevMonth() {
    setSelectedDay(null);
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    setSelectedDay(null);
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(today.getDate());
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDow = getFirstDayOfWeek(viewYear, viewMonth);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function dayKey(day: number): string {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const selectedLeads = selectedDay ? (leadsByDate[dayKey(selectedDay)] || []) : [];

  if (!authChecked) return null;

  if (!authed) {
    return (
      <div className="app-shell">
        <CrmNav current="/crm/calendar" subtitle="Follow-up Calendar" />
        <div className="container login">
          <div className="card">
            <h1>Secure Workspace</h1>
            <p className="tagline">Enter your app password to continue.</p>
            {notice ? <div className="notice">{notice}</div> : null}
            <form onSubmit={handleLogin}>
              <input
                type="password"
                placeholder="App password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Checking...' : 'Unlock'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <CrmNav current="/crm/calendar" subtitle="Follow-up Calendar" />

      <main className="container">
        <div className="header">
          <div>
            <h1>Follow-up Calendar</h1>
            <p className="tagline">Leads scheduled for follow-up by date.</p>
          </div>
        </div>

        {fetchError && (
          <div className="notice" style={{ marginBottom: 16 }}>{fetchError}</div>
        )}

        {/* Today's Activity Bar */}
        {(activity.emailsByDate[todayKey] || activity.leadsImportedByDate[todayKey]) ? (
          <div className="cal-activity-bar">
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Today&apos;s Activity</span>
            {activity.emailsByDate[todayKey] && (
              <span style={{ color: 'var(--info-text)' }}>
                ✉ <strong>{activity.emailsByDate[todayKey].total}</strong> emails sent
                {activity.emailsByDate[todayKey].email1 > 0 && ` · E1: ${activity.emailsByDate[todayKey].email1}`}
                {activity.emailsByDate[todayKey].email2 > 0 && ` · E2: ${activity.emailsByDate[todayKey].email2}`}
                {activity.emailsByDate[todayKey].email3 > 0 && ` · E3: ${activity.emailsByDate[todayKey].email3}`}
              </span>
            )}
            {(activity.leadsImportedByDate[todayKey] || 0) > 0 && (
              <span style={{ color: 'var(--success-text)' }}>
                🎯 <strong>{activity.leadsImportedByDate[todayKey]}</strong> leads imported
              </span>
            )}
          </div>
        ) : null}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Calendar Header */}
          <div className="cal-header">
            <div className="cal-nav">
              <button onClick={prevMonth} className="cal-nav-btn" aria-label="Previous month">‹</button>
              <span className="cal-month-label">{MONTHS[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} className="cal-nav-btn" aria-label="Next month">›</button>
            </div>
            <div className="cal-nav">
              {fetching && <span className="activity-meta">Loading…</span>}
              <button onClick={goToday}>Today</button>
            </div>
          </div>

          {/* Day-of-week headers */}
          <div className="cal-dow-grid">
            {DOW.map(d => (
              <div key={d} className="cal-dow-cell">{d}</div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="cal-grid">
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="cal-cell cal-cell--empty" />;
              }

              const key = dayKey(day);
              const dayLeads = leadsByDate[key] || [];
              const isToday = key === todayKey;
              const isSelected = day === selectedDay;
              const dayEmails = activity.emailsByDate[key];
              const dayImports = activity.leadsImportedByDate[key] || 0;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`cal-cell cal-cell--active${isSelected ? ' cal-cell--selected' : ''}`}
                >
                  <div className={`cal-day-num${isToday ? ' cal-day-num--today' : isSelected ? ' cal-day-num--selected' : ''}`}>
                    {day}
                  </div>

                  {/* Activity badges */}
                  {(dayEmails || dayImports > 0) && (
                    <div className="cal-badges">
                      {dayEmails && dayEmails.total > 0 && (
                        <span
                          className="cal-badge cal-badge--email"
                          title={`Emails sent: E1=${dayEmails.email1} E2=${dayEmails.email2} E3=${dayEmails.email3}`}
                        >
                          ✉ {dayEmails.total}
                        </span>
                      )}
                      {dayImports > 0 && (
                        <span className="cal-badge cal-badge--import" title={`${dayImports} leads imported`}>
                          + {dayImports}
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {dayLeads.slice(0, 3).map(lead => {
                      const s = getStatusStyle(lead.status);
                      return (
                        <div key={lead.id} className="cal-lead-chip" style={{ background: s.bg, color: s.text }}>
                          <span className="cal-lead-dot" style={{ background: s.dot }} />
                          {NEXT_ACTION[lead.status || ''] ? `${NEXT_ACTION[lead.status!]} · ` : ''}{lead.company_name}
                        </div>
                      );
                    })}
                    {dayLeads.length > 3 && (
                      <div style={{ fontSize: 10, color: 'var(--muted)', paddingLeft: 4 }}>
                        +{dayLeads.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Panel */}
        {selectedDay !== null && (() => {
          const selKey = dayKey(selectedDay);
          const selEmails = activity.emailsByDate[selKey];
          const selImports = activity.leadsImportedByDate[selKey] || 0;
          return (
          <div className="card cal-detail-panel">
            <div className="cal-detail-header">
              <div className="section-title" style={{ marginBottom: 0 }}>
                {MONTHS[viewMonth]} {selectedDay}, {viewYear}
                {selectedLeads.length === 0 && !selEmails && selImports === 0 && (
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', marginLeft: 8 }}>
                    — No activity
                  </span>
                )}
              </div>
              {(selEmails || selImports > 0) && (
                <div className="cal-detail-badges">
                  {selEmails && selEmails.total > 0 && (
                    <span className="cal-detail-badge cal-detail-badge--email">
                      ✉ {selEmails.total} sent
                      {selEmails.email1 > 0 && <span style={{ opacity: 0.7 }}> · E1:{selEmails.email1}</span>}
                      {selEmails.email2 > 0 && <span style={{ opacity: 0.7 }}> · E2:{selEmails.email2}</span>}
                      {selEmails.email3 > 0 && <span style={{ opacity: 0.7 }}> · E3:{selEmails.email3}</span>}
                    </span>
                  )}
                  {selImports > 0 && (
                    <span className="cal-detail-badge cal-detail-badge--import">
                      🎯 {selImports} imported
                    </span>
                  )}
                </div>
              )}
            </div>

            {selectedLeads.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedLeads.map(lead => {
                  const s = getStatusStyle(lead.status);
                  return (
                    <div key={lead.id} className="cal-lead-card">
                      <span className="cal-lead-card-dot" style={{ background: s.dot }} />
                      <div className="cal-lead-card-info">
                        <div className="cal-lead-card-name">{lead.company_name}</div>
                        {lead.category && (
                          <div className="activity-meta">{lead.category}</div>
                        )}
                      </div>
                      <span className="cal-lead-card-status" style={{ background: s.bg, color: s.text }}>
                        {NEXT_ACTION[lead.status || ''] || lead.status || 'Follow up'}
                      </span>
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="cal-lead-card-link"
                          style={{ color: 'var(--accent)' }}
                          onClick={e => e.stopPropagation()}
                        >
                          ✉ {lead.email}
                        </a>
                      ) : lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cal-lead-card-link"
                          style={{ color: 'var(--muted)' }}
                          onClick={e => e.stopPropagation()}
                        >
                          ↗ website
                        </a>
                      ) : null}
                      <a
                        href={`/crm?search=${encodeURIComponent(lead.company_name)}`}
                        className="cal-lead-card-view"
                        onClick={e => e.stopPropagation()}
                      >
                        View →
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
        })()}

        {/* Legend */}
        <div className="cal-legend">
          {Object.entries(STATUS_COLORS).map(([status, style]) => (
            <div key={status} className="cal-legend-item">
              <span className="cal-legend-dot" style={{ background: style.dot }} />
              {status}
            </div>
          ))}
          <div className="cal-legend-divider" />
          <div className="cal-legend-item">
            <span className="cal-badge cal-badge--email">✉ 5</span>
            Emails sent
          </div>
          <div className="cal-legend-item">
            <span className="cal-badge cal-badge--import">+ 10</span>
            Leads imported
          </div>
        </div>
      </main>
    </div>
  );
}
