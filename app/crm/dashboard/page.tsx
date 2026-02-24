'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'leadcrm_password';

const STATUS_ORDER = [
  'Not Contacted',
  'Email 1 Sent',
  'Email 2 Sent',
  'Email 3 Sent',
  'Replied',
  'Not Fit',
  'Do Not Contact',
];

const STATUS_COLOR: Record<string, string> = {
  'Not Contacted':  '#9ca3af',
  'Email 1 Sent':   '#3b82f6',
  'Email 2 Sent':   '#6366f1',
  'Email 3 Sent':   '#f97316',
  'Replied':        '#22c55e',
  'Not Fit':        '#ef4444',
  'Do Not Contact': '#4b5563',
};

const TEMPLATE_LABEL: Record<string, string> = {
  email1: 'Email 1',
  email2: 'Email 2',
  email3: 'Email 3',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setToken(saved);
    else window.location.href = '/crm';
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch('/api/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const totalLeads = stats?.leads?.total || 0;
  const sentToday = stats?.emails?.sentToday || 0;
  const dailyLimit = 20;
  const pct = Math.min(100, Math.round((sentToday / dailyLimit) * 100));

  const funnelStatuses = STATUS_ORDER.filter(s =>
    !['Not Fit', 'Do Not Contact'].includes(s)
  );
  const maxFunnelCount = Math.max(
    1,
    ...funnelStatuses.map(s => stats?.leads?.byStatus?.[s] || 0)
  );

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-title">SersweAI CRM</div>
            <div className="brand-sub">Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/crm" style={{ fontSize: 13, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--ink)' }}>
            ← Pipeline
          </a>
          <a href="/crm/calendar" style={{ fontSize: 13, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--ink)' }}>
            Calendar →
          </a>
          <div className="badge">Dashboard</div>
        </div>
      </div>

      <div className="container">
        <div className="header">
          <h1>Campaign Dashboard</h1>
          <p className="tagline">Live view of your daily lead gen + outreach pipeline.</p>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading...</p>
        ) : (
          <>
            {/* Top stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              <StatCard label="Total Leads" value={totalLeads} sub={`${stats?.leads?.withEmail || 0} have email`} color="var(--accent)" />
              <StatCard label="Added Today" value={stats?.leads?.addedToday || 0} sub="from lead gen" color="#6366f1" />
              <StatCard label="Emails Sent Today" value={`${sentToday} / ${dailyLimit}`} sub={`${pct}% of daily quota`} color="#f97316" />
              <StatCard label="Sent This Week" value={stats?.emails?.sentThisWeek || 0} sub={`Email 1: ${stats?.emails?.byTemplate?.email1 || 0}  ·  2: ${stats?.emails?.byTemplate?.email2 || 0}  ·  3: ${stats?.emails?.byTemplate?.email3 || 0}`} color="#3b82f6" />
              <StatCard label="Replied" value={stats?.leads?.byStatus?.['Replied'] || 0} sub={totalLeads ? `${Math.round(((stats?.leads?.byStatus?.['Replied'] || 0) / totalLeads) * 100)}% reply rate` : '—'} color="#22c55e" />
            </div>

            {/* Daily quota bar */}
            <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Today's Send Quota</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{sentToday} of {dailyLimit} emails sent</span>
              </div>
              <div style={{ height: 10, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#22c55e' : 'var(--accent)', borderRadius: 99, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                {Object.entries(stats?.emails?.byTemplate || {}).map(([k, v]) => (
                  <span key={k}><strong style={{ color: 'var(--ink)' }}>{v as number}</strong> {TEMPLATE_LABEL[k] || k}</span>
                ))}
                {sentToday === 0 && <span>No emails sent yet today — auto-send runs at 7 AM PT</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Funnel */}
              <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Outreach Funnel
                </div>
                {funnelStatuses.map(status => {
                  const count = stats?.leads?.byStatus?.[status] || 0;
                  const barPct = Math.round((count / maxFunnelCount) * 100);
                  return (
                    <div key={status} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status], display: 'inline-block' }} />
                          {status}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{count}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${barPct}%`, background: STATUS_COLOR[status], borderRadius: 99 }} />
                      </div>
                    </div>
                  );
                })}
                {/* Suppressed */}
                {(['Not Fit', 'Do Not Contact'] as const).map(s => {
                  const count = stats?.leads?.byStatus?.[s] || 0;
                  if (!count) return null;
                  return (
                    <div key={s} style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[s], display: 'inline-block', marginRight: 6 }} />
                      {s}: {count}
                    </div>
                  );
                })}
              </div>

              {/* Recent sends */}
              <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Recent Sends
                </div>
                {(stats?.emails?.recent || []).length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>No emails sent yet.</p>
                ) : (
                  (stats?.emails?.recent || []).map((e: any) => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{(e.leads as any)?.company_name || e.to_email}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(e.leads as any)?.category || ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', display: 'inline-block' }}>
                          {TEMPLATE_LABEL[e.template] || e.template}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{e.sent_at ? timeAgo(e.sent_at) : '—'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Schedule info */}
            <div style={{ marginTop: 20, padding: '14px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, fontSize: 13, color: '#15803d' }}>
              <strong>Automation running:</strong> Lead gen daily at 6 AM PT · Auto-send daily at 7 AM PT · Up to 20 new leads + 20 emails per day
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: '-0.02em', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div>
    </div>
  );
}
