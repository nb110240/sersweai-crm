'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'leadcrm_password';

const STAGES = ['Discovery', 'Proposal', 'Closed Won', 'Closed Lost'] as const;
type Stage = typeof STAGES[number];

const STAGE_COLORS: Record<Stage, { bg: string; border: string; label: string }> = {
  'Discovery':   { bg: '#eff6ff', border: '#bfdbfe', label: '#1d4ed8' },
  'Proposal':    { bg: '#faf5ff', border: '#e9d5ff', label: '#7c3aed' },
  'Closed Won':  { bg: '#f0fdf4', border: '#bbf7d0', label: '#15803d' },
  'Closed Lost': { bg: '#fef2f2', border: '#fecaca', label: '#b91c1c' },
};

type Deal = {
  id: string;
  lead_id: string | null;
  company_name: string;
  stage: Stage;
  value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export default function DealsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingValue, setEditingValue] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) { window.location.href = '/crm'; return; }
    setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchDeals();
  }, [token]);

  async function fetchDeals() {
    setLoading(true);
    const res = await fetch('/api/deals', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setDeals(data.deals || []);
    setLoading(false);
  }

  async function updateDeal(id: string, updates: Partial<Deal>) {
    const res = await fetch(`/api/deals/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.deal) setDeals(prev => prev.map(d => d.id === id ? data.deal : d));
  }

  async function deleteDeal(id: string) {
    if (!confirm('Delete this deal?')) return;
    await fetch(`/api/deals/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setDeals(prev => prev.filter(d => d.id !== id));
  }

  async function createDeal() {
    const company_name = prompt('Company name?');
    if (!company_name?.trim()) return;
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: company_name.trim() }),
    });
    const data = await res.json();
    if (data.deal) setDeals(prev => [data.deal, ...prev]);
  }

  function formatValue(v: number) {
    return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`;
  }

  function daysAgo(dateStr: string) {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    return days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`;
  }

  const pipelineValue = deals.filter(d => d.stage === 'Discovery' || d.stage === 'Proposal').reduce((sum, d) => sum + (d.value || 0), 0);
  const wonValue = deals.filter(d => d.stage === 'Closed Won').reduce((sum, d) => sum + (d.value || 0), 0);
  const activeDeals = deals.filter(d => d.stage === 'Discovery' || d.stage === 'Proposal').length;

  if (!token) return null;

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-title">SersweAI CRM</div>
            <div className="brand-sub">Deal Pipeline</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/crm" style={{ fontSize: 13, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--ink)' }}>← Pipeline</a>
          <a href="/crm/dashboard" style={{ fontSize: 13, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--ink)' }}>Dashboard</a>
          <a href="/crm/calendar" style={{ fontSize: 13, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--ink)' }}>Calendar</a>
        </div>
      </div>

      <div className="container">
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Deal Pipeline</h1>
            <p className="tagline">Track opportunities from discovery to close.</p>
          </div>
          <button onClick={createDeal} style={{ marginTop: 4 }}>+ New Deal</button>
        </div>

        {/* Summary bar */}
        <div className="dashboard-grid" style={{ marginBottom: 24 }}>
          <div className="dashboard-card">
            <div className="dashboard-label">Active Deals</div>
            <div className="dashboard-value">{activeDeals}</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-label">Pipeline Value</div>
            <div className="dashboard-value" style={{ color: '#6366f1' }}>${pipelineValue.toLocaleString()}</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-label">Closed Won</div>
            <div className="dashboard-value" style={{ color: '#16a34a' }}>${wonValue.toLocaleString()}</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-label">Total Deals</div>
            <div className="dashboard-value">{deals.length}</div>
          </div>
        </div>

        {loading ? <p>Loading deals...</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, alignItems: 'start' }}>
            {STAGES.map(stage => {
              const stageDeals = deals.filter(d => d.stage === stage);
              const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
              const colors = STAGE_COLORS[stage];
              return (
                <div key={stage} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: colors.label }}>{stage}</div>
                    <div style={{ fontSize: 12, color: colors.label, fontWeight: 600 }}>
                      {stageDeals.length} · ${stageValue.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {stageDeals.length === 0 && (
                      <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No deals</div>
                    )}
                    {stageDeals.map(deal => (
                      <div key={deal.id} style={{ background: 'white', borderRadius: 10, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{deal.company_name}</div>

                        {/* Value editor */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>Value:</span>
                          <input
                            type="number"
                            value={editingValue[deal.id] ?? deal.value}
                            onChange={e => setEditingValue(prev => ({ ...prev, [deal.id]: e.target.value }))}
                            onBlur={() => {
                              const val = parseFloat(editingValue[deal.id] ?? String(deal.value)) || 0;
                              updateDeal(deal.id, { value: val });
                              setEditingValue(prev => { const n = { ...prev }; delete n[deal.id]; return n; });
                            }}
                            style={{ width: 80, fontSize: 13, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--border)', fontWeight: 600 }}
                          />
                        </div>

                        {/* Notes */}
                        <textarea
                          placeholder="Notes..."
                          defaultValue={deal.notes || ''}
                          onBlur={e => updateDeal(deal.id, { notes: e.target.value })}
                          rows={2}
                          style={{ width: '100%', fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        />

                        {/* Stage selector */}
                        <select
                          value={deal.stage}
                          onChange={e => updateDeal(deal.id, { stage: e.target.value as Stage })}
                          style={{ width: '100%', fontSize: 12, marginTop: 8, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)' }}
                        >
                          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>
                            {daysAgo(deal.updated_at)} ago
                          </span>
                          <button
                            onClick={() => deleteDeal(deal.id)}
                            style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
