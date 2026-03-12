'use client';

import { useEffect, useState, useCallback } from 'react';
import CrmNav from '../../../components/CrmNav';

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
  'Not Contacted':  'var(--status-gray)',
  'Email 1 Sent':   'var(--status-blue)',
  'Email 2 Sent':   'var(--status-indigo)',
  'Email 3 Sent':   'var(--status-orange)',
  'Replied':        'var(--status-green)',
  'Not Fit':        'var(--status-red)',
  'Do Not Contact': 'var(--status-dark)',
};

const TEMPLATE_LABEL: Record<string, string> = {
  email1: 'Email 1',
  email2: 'Email 2',
  email3: 'Email 3',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface StatsData {
  leads?: {
    total?: number;
    withEmail?: number;
    addedToday?: number;
    byStatus?: Record<string, number>;
  };
  emails?: {
    sentToday?: number;
    sentThisWeek?: number;
    totalSent?: number;
    byTemplate?: Record<string, number>;
    recent?: Array<{
      id: string;
      template: string;
      to_email: string;
      sent_at: string;
      leads?: { company_name?: string; category?: string };
    }>;
  };
  traffic?: {
    viewsToday?: number;
    uniqueToday?: number;
    viewsThisWeek?: number;
    uniqueThisWeek?: number;
    topPages?: Array<{ path: string; views: number }>;
  };
  recentOpens?: Array<{
    lead_id: string;
    company_name: string;
    template?: string;
    opened_at: string;
  }>;
  recentClicks?: Array<{
    lead_id: string;
    company_name: string;
    url_hostname: string;
    clicked_at: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    setError(null);
    fetch('/api/stats')
      .then(r => {
        if (r.status === 401) { window.location.href = '/crm'; return null; }
        if (!r.ok) throw new Error(`Failed to load stats (${r.status})`);
        return r.json();
      })
      .then(d => { if (d) setStats(d); })
      .catch(e => setError(e.message || 'Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const totalLeads = stats?.leads?.total || 0;
  const sentToday = stats?.emails?.sentToday || 0;
  const dailyLimit = 50;
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
      <CrmNav current="/crm/dashboard" subtitle="Dashboard" />

      <main className="container">
        <div className="header">
          <div>
            <h1>Campaign Dashboard</h1>
            <p className="tagline">Live view of your daily lead gen + outreach pipeline.</p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={fetchStats} type="button">Retry</button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div aria-busy="true" aria-label="Loading dashboard data">
            <div className="stat-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-card" />
              ))}
            </div>
            <div className="skeleton skeleton-bar" style={{ marginBottom: 24 }} />
            <div className="skeleton skeleton-bar" style={{ marginBottom: 24 }} />
            <div className="two-col-grid">
              <div className="skeleton skeleton-block" />
              <div className="skeleton skeleton-block" />
            </div>
          </div>
        ) : stats && (
          <>
            {/* Stat cards */}
            <div className="stat-grid" role="region" aria-label="Key metrics">
              <StatCard label="Total Leads" value={totalLeads} sub={`${stats.leads?.withEmail || 0} have email`} color="var(--accent)" />
              <StatCard label="Added Today" value={stats.leads?.addedToday || 0} sub="from lead gen" color="var(--status-indigo)" />
              <StatCard label="Emails Today" value={`${sentToday} / ${dailyLimit}`} sub={`${pct}% of daily quota`} color="var(--status-orange)" />
              <StatCard label="Sent This Week" value={stats.emails?.sentThisWeek || 0} sub={`Mon–Sun · E1: ${stats.emails?.byTemplate?.email1 || 0} · E2: ${stats.emails?.byTemplate?.email2 || 0} · E3: ${stats.emails?.byTemplate?.email3 || 0}`} color="var(--status-blue)" />
              <StatCard label="Total Sent" value={stats.emails?.totalSent || 0} sub="all time" color="var(--status-purple)" />
              <StatCard label="Replied" value={stats.leads?.byStatus?.['Replied'] || 0} sub={totalLeads ? `${Math.round(((stats.leads?.byStatus?.['Replied'] || 0) / totalLeads) * 100)}% reply rate` : '—'} color="var(--status-green)" />
            </div>

            {/* Daily quota */}
            <div className="card-section" style={{ marginBottom: 24 }}>
              <div className="quota-header">
                <span className="quota-label">Today&apos;s Send Quota</span>
                <span className="quota-count">{sentToday} of {dailyLimit} emails sent</span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuenow={sentToday}
                aria-valuemin={0}
                aria-valuemax={dailyLimit}
                aria-label={`${sentToday} of ${dailyLimit} emails sent today`}
              >
                <div
                  className="progress-fill"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 100 ? 'var(--status-green)' : 'var(--accent)',
                  }}
                />
              </div>
              <div className="quota-breakdown">
                {Object.entries(stats.emails?.byTemplate || {}).map(([k, v]) => (
                  <span key={k}><strong style={{ color: 'var(--ink)' }}>{v as number}</strong> {TEMPLATE_LABEL[k] || k}</span>
                ))}
                {sentToday === 0 && <span>No emails sent yet — auto-send runs at 7 AM PT</span>}
              </div>
            </div>

            {/* Website Traffic */}
            <div className="card-section" style={{ marginBottom: 24 }}>
              <div className="section-title">Website Traffic</div>
              <div className="traffic-grid">
                <TrafficStat value={stats.traffic?.viewsToday ?? 0} label="Views Today" color="var(--status-purple)" />
                <TrafficStat value={stats.traffic?.uniqueToday ?? 0} label="Unique Today" color="var(--status-purple)" />
                <TrafficStat value={stats.traffic?.viewsThisWeek ?? 0} label="Views This Week" color="var(--status-indigo)" />
                <TrafficStat value={stats.traffic?.uniqueThisWeek ?? 0} label="Unique This Week" color="var(--status-indigo)" />
              </div>
              {(stats.traffic?.topPages || []).length > 0 ? (
                <div>
                  <div className="section-title" style={{ fontSize: 11, marginBottom: 8 }}>Top Pages</div>
                  {(stats.traffic?.topPages || []).map(p => (
                    <div key={p.path} className="top-pages-row">
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.path}</span>
                      <span style={{ fontWeight: 600 }}>{p.views}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No page views recorded yet.</p>
              )}
            </div>

            {/* Two-column: Funnel + Recent Sends */}
            <div className="two-col-grid" style={{ marginBottom: 20 }}>
              {/* Funnel */}
              <div className="card-section" role="region" aria-label="Outreach funnel">
                <div className="section-title">Outreach Funnel</div>
                {funnelStatuses.map(status => {
                  const count = stats.leads?.byStatus?.[status] || 0;
                  const barPct = Math.round((count / maxFunnelCount) * 100);
                  return (
                    <div key={status} className="funnel-row">
                      <div className="funnel-header">
                        <span className="funnel-status">
                          <span className="funnel-dot" style={{ background: STATUS_COLOR[status] }} aria-hidden="true" />
                          {status}
                        </span>
                        <span className="funnel-count">{count}</span>
                      </div>
                      <div
                        className="funnel-bar-track"
                        role="progressbar"
                        aria-valuenow={count}
                        aria-valuemin={0}
                        aria-valuemax={maxFunnelCount}
                        aria-label={`${status}: ${count} leads`}
                      >
                        <div className="funnel-bar-fill" style={{ width: `${barPct}%`, background: STATUS_COLOR[status] }} />
                      </div>
                    </div>
                  );
                })}
                {(['Not Fit', 'Do Not Contact'] as const).map(s => {
                  const count = stats.leads?.byStatus?.[s] || 0;
                  if (!count) return null;
                  return (
                    <div key={s} className="suppressed-item">
                      <span className="suppressed-dot" style={{ background: STATUS_COLOR[s] }} aria-hidden="true" />
                      {s}: {count}
                    </div>
                  );
                })}
              </div>

              {/* Recent Sends */}
              <div className="card-section">
                <div className="section-title">Recent Sends</div>
                {(stats.emails?.recent || []).length === 0 ? (
                  <p className="empty-state">No emails sent yet.</p>
                ) : (
                  (stats.emails?.recent || []).map(e => (
                    <div key={e.id} className="activity-row">
                      <div>
                        <div className="activity-name">{e.leads?.company_name || e.to_email}</div>
                        <div className="activity-meta">{e.leads?.category || ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="template-badge template-badge--send">
                          {TEMPLATE_LABEL[e.template] || e.template}
                        </span>
                        <div className="activity-meta" style={{ marginTop: 2 }}>{e.sent_at ? timeAgo(e.sent_at) : '—'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Recent Opens */}
              <div className="card-section">
                <div className="section-title">Recent Opens</div>
                {(stats.recentOpens || []).length === 0 ? (
                  <p className="empty-state">No opens tracked yet.</p>
                ) : (
                  (stats.recentOpens || []).map(o => (
                    <div key={o.lead_id} className="activity-row">
                      <div className="activity-name">{o.company_name}</div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="template-badge template-badge--open">
                          {TEMPLATE_LABEL[o.template || ''] || 'Open'}
                        </span>
                        <div className="activity-meta" style={{ marginTop: 2 }}>{o.opened_at ? timeAgo(o.opened_at) : '—'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Recent Clicks */}
              <div className="card-section">
                <div className="section-title">Recent Clicks</div>
                {(stats.recentClicks || []).length === 0 ? (
                  <p className="empty-state">No clicks tracked yet.</p>
                ) : (
                  (stats.recentClicks || []).map(c => (
                    <div key={c.lead_id} className="activity-row">
                      <div>
                        <div className="activity-name">{c.company_name}</div>
                        <div className="activity-meta">{c.url_hostname}</div>
                      </div>
                      <div className="activity-meta">{c.clicked_at ? timeAgo(c.clicked_at) : '—'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Automation banner */}
            <div className="automation-banner">
              <strong>Automation running:</strong> Lead gen daily at 6 AM PT · Auto-send daily at 7 AM PT · Up to 20 new leads + 50 emails per day
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function TrafficStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <div className="traffic-value" style={{ color }}>{value}</div>
      <div className="traffic-label">{label}</div>
    </div>
  );
}
