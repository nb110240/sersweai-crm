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

export default function CalendarPage() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [fetchError, setFetchError] = useState('');
  const [fetching, setFetching] = useState(false);

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
    fetch('/api/leads', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setLeads(data.leads || []);
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
                    position: 'relative'
                  }}
                >
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26, borderRadius: '50%',
                    background: isToday ? 'var(--accent)' : 'transparent',
                    color: isToday ? '#fff' : isSelected ? 'var(--accent)' : 'var(--ink)',
                    fontWeight: isToday || isSelected ? 700 : 400,
                    fontSize: 13, marginBottom: 4
                  }}>
                    {day}
                  </div>

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
                          {lead.company_name}
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
        {selectedDay !== null && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'var(--muted)',
              marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              {MONTHS[viewMonth]} {selectedDay}, {viewYear}
              {selectedLeads.length === 0 && (
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 'normal', marginLeft: 8 }}>
                  — No follow-ups scheduled
                </span>
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
                        {lead.status || 'Not Contacted'}
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
        )}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16, paddingBottom: 32 }}>
          {Object.entries(STATUS_COLORS).map(([status, style]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: style.dot, display: 'inline-block' }} />
              {status}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
