'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'leadcrm_password';

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
  'Not Contacted':   { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af' },
  'Email 1 Sent':    { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  'Email 2 Sent':    { bg: '#eef2ff', text: '#4338ca', dot: '#6366f1' },
  'Email 3 Sent':    { bg: '#fff7ed', text: '#c2410c', dot: '#f97316' },
  'Replied':         { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
  'Not Fit':         { bg: '#fef2f2', text: '#b91c1c', dot: '#ef4444' },
  'Do Not Contact':  { bg: '#f9fafb', text: '#374151', dot: '#4b5563' },
};

// What action is due on the follow-up date
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
  // Normalize to YYYY-MM-DD regardless of timezone
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
  const [token, setToken] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [fetchError, setFetchError] = useState('');
  const [fetching, setFetching] = useState(false);
  const [activity, setActivity] = useState<ActivityByDate>({ emailsByDate: {}, leadsImportedByDate: {} });

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    setFetching(true);
    setFetchError('');
    Promise.all([
      fetch('/api/leads', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/activity', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([leadsData, activityData]) => {
        if (leadsData.error) throw new Error(leadsData.error);
        setLeads(leadsData.leads || []);
        setActivity(activityData);
      })
      .catch(e => setFetchError(e.message))
      .finally(() => setFetching(false));
  }, [token]);

  const isAuthed = useMemo(() => Boolean(token), [token]);

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
      window.localStorage.setItem(STORAGE_KEY, password);
      setToken(password);
      setPassword('');
    } catch (err: any) {
      setNotice(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  // Group leads by date key
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

  // Build calendar grid (6 rows max)
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function dayKey(day: number): string {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const selectedLeads = selectedDay ? (leadsByDate[dayKey(selectedDay)] || []) : [];

  if (!isAuthed) {
    return (
      <div className="app-shell">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark" />
            <div>
              <div className="brand-title">SersweAI CRM</div>
              <div className="brand-sub">Follow-up Calendar</div>
            </div>
          </div>
        </div>
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
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-title">SersweAI CRM</div>
            <div className="brand-sub">Follow-up Calendar</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/crm" style={{ fontSize: 13, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
            &larr; Pipeline
          </a>
          <a href="/crm/contacts" style={{ fontSize: 13, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
            Contacts &rarr;
          </a>
          <div className="badge">Calendar</div>
        </div>
      </div>

      <div className="container">
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
          <div style={{
            display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
            padding: '12px 18px', marginBottom: 16, borderRadius: 12,
            background: '#f8faff', border: '1px solid #dbeafe', fontSize: 13
          }}>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Today's Activity</span>
            {activity.emailsByDate[todayKey] && (
              <>
                <span style={{ color: '#1d4ed8' }}>
                  ✉ <strong>{activity.emailsByDate[todayKey].total}</strong> emails sent
                  {activity.emailsByDate[todayKey].email1 > 0 && ` · E1: ${activity.emailsByDate[todayKey].email1}`}
                  {activity.emailsByDate[todayKey].email2 > 0 && ` · E2: ${activity.emailsByDate[todayKey].email2}`}
                  {activity.emailsByDate[todayKey].email3 > 0 && ` · E3: ${activity.emailsByDate[todayKey].email3}`}
                </span>
              </>
            )}
            {(activity.leadsImportedByDate[todayKey] || 0) > 0 && (
              <span style={{ color: '#15803d' }}>
                🎯 <strong>{activity.leadsImportedByDate[todayKey]}</strong> leads imported
              </span>
            )}
          </div>
        ) : null}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Calendar Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={prevMonth}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '4px 10px', cursor: 'pointer', fontSize: 16, color: 'var(--ink)'
                }}
              >
                ‹
              </button>
              <span style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-display)', minWidth: 160, textAlign: 'center' }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                onClick={nextMonth}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '4px 10px', cursor: 'pointer', fontSize: 16, color: 'var(--ink)'
                }}
              >
                ›
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {fetching && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</span>}
              <button
                onClick={goToday}
                style={{
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13
                }}
              >
                Today
              </button>
            </div>
          </div>

          {/* Day-of-week headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '1px solid var(--border)',
            background: '#fafaf9'
          }}>
            {DOW.map(d => (
              <div key={d} style={{
                padding: '8px 0', textAlign: 'center', fontSize: 11,
                fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {cells.map((day, idx) => {
              if (day === null) {
                return (
                  <div key={`empty-${idx}`} style={{
                    minHeight: 90, borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                    borderBottom: '1px solid var(--border)', background: '#fafaf9'
                  }} />
                );
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
                  style={{
                    minHeight: 90,
                    borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                    borderBottom: '1px solid var(--border)',
                    padding: '8px 6px',
                    cursor: 'pointer',
                    background: isSelected ? '#f0f9f8' : 'var(--card)',
                    transition: 'background 0.1s',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3
                  }}
                >
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26, borderRadius: '50%',
                    background: isToday ? 'var(--accent)' : 'transparent',
                    color: isToday ? '#fff' : isSelected ? 'var(--accent)' : 'var(--ink)',
                    fontWeight: isToday || isSelected ? 700 : 400,
                    fontSize: 13, marginBottom: 2
                  }}>
                    {day}
                  </div>

                  {/* Activity badges */}
                  {(dayEmails || dayImports > 0) && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 2 }}>
                      {dayEmails && dayEmails.total > 0 && (
                        <span
                          title={`Emails sent: E1=${dayEmails.email1} E2=${dayEmails.email2} E3=${dayEmails.email3}`}
                          style={{
                            fontSize: 9, padding: '1px 4px', borderRadius: 4,
                            background: '#eff6ff', color: '#1d4ed8', fontWeight: 600,
                            lineHeight: '14px', whiteSpace: 'nowrap'
                          }}
                        >
                          ✉ {dayEmails.total}
                        </span>
                      )}
                      {dayImports > 0 && (
                        <span
                          title={`${dayImports} leads imported`}
                          style={{
                            fontSize: 9, padding: '1px 4px', borderRadius: 4,
                            background: '#f0fdf4', color: '#15803d', fontWeight: 600,
                            lineHeight: '14px', whiteSpace: 'nowrap'
                          }}
                        >
                          + {dayImports}
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {dayLeads.slice(0, 3).map(lead => {
                      const style = getStatusStyle(lead.status);
                      return (
                        <div key={lead.id} style={{
                          fontSize: 10, padding: '2px 5px', borderRadius: 4,
                          background: style.bg, color: style.text,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          display: 'flex', alignItems: 'center', gap: 3
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: style.dot, flexShrink: 0, display: 'inline-block'
                          }} />
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
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {MONTHS[viewMonth]} {selectedDay}, {viewYear}
                {selectedLeads.length === 0 && !selEmails && selImports === 0 && (
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', marginLeft: 8 }}>
                    — No activity
                  </span>
                )}
              </div>
              {(selEmails || selImports > 0) && (
                <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                  {selEmails && selEmails.total > 0 && (
                    <span style={{ color: '#1d4ed8', background: '#eff6ff', padding: '3px 10px', borderRadius: 8, fontWeight: 500 }}>
                      ✉ {selEmails.total} sent
                      {selEmails.email1 > 0 && <span style={{ color: '#60a5fa' }}> · E1:{selEmails.email1}</span>}
                      {selEmails.email2 > 0 && <span style={{ color: '#818cf8' }}> · E2:{selEmails.email2}</span>}
                      {selEmails.email3 > 0 && <span style={{ color: '#fb923c' }}> · E3:{selEmails.email3}</span>}
                    </span>
                  )}
                  {selImports > 0 && (
                    <span style={{ color: '#15803d', background: '#f0fdf4', padding: '3px 10px', borderRadius: 8, fontWeight: 500 }}>
                      🎯 {selImports} imported
                    </span>
                  )}
                </div>
              )}
            </div>

            {selectedLeads.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedLeads.map(lead => {
                  const style = getStatusStyle(lead.status);
                  return (
                    <div key={lead.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: '#fafaf9'
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: style.dot, flexShrink: 0
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{lead.company_name}</div>
                        {lead.category && (
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{lead.category}</div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 6,
                        background: style.bg, color: style.text, fontWeight: 500, whiteSpace: 'nowrap'
                      }}>
                        {NEXT_ACTION[lead.status || ''] || lead.status || 'Follow up'}
                      </span>
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                          onClick={e => e.stopPropagation()}
                        >
                          ✉ {lead.email}
                        </a>
                      ) : lead.website ? (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}
                          onClick={e => e.stopPropagation()}
                        >
                          ↗ website
                        </a>
                      ) : null}
                      <a
                        href={`/crm?search=${encodeURIComponent(lead.company_name)}`}
                        style={{
                          fontSize: 11, color: 'var(--muted)', textDecoration: 'none',
                          padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6
                        }}
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16, paddingBottom: 32, alignItems: 'center' }}>
          {Object.entries(STATUS_COLORS).map(([status, style]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: style.dot, display: 'inline-block' }} />
              {status}
            </div>
          ))}
          <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 4px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600, lineHeight: '14px' }}>✉ 5</span>
            Emails sent
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, background: '#f0fdf4', color: '#15803d', fontWeight: 600, lineHeight: '14px' }}>+ 10</span>
            Leads imported
          </div>
        </div>
      </div>
    </div>
  );
}
