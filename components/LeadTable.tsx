'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import LeadTimeline from './LeadTimeline';

export type Lead = {
  id: string;
  company_name: string;
  category: string | null;
  zip: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  contact_form_url: string | null;
  summary: string | null;
  status: string | null;
  last_contacted: string | null;
  next_follow_up: string | null;
  reply_type: string | null;
  notes: string | null;
  opens: number;
  clicked: boolean;
};

type Props = {
  token: string;
};

const STATUS_OPTIONS = [
  'Not Contacted',
  'Email 1 Sent',
  'Email 2 Sent',
  'Email 3 Sent',
  'Replied',
  'Not Fit',
  'Do Not Contact'
];

export default function LeadTable({ token }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [sendingLeads, setSendingLeads] = useState<Record<string, string>>({});
  const [convertingLeads, setConvertingLeads] = useState<Record<string, boolean>>({});
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const statusCounts = useMemo(() => {
    const counts = STATUS_OPTIONS.reduce<Record<string, number>>((acc, option) => {
      acc[option] = 0;
      return acc;
    }, {});

    for (const lead of leads) {
      const currentStatus = lead.status || 'Not Contacted';
      if (counts[currentStatus] !== undefined) {
        counts[currentStatus] += 1;
      }
    }

    return counts;
  }, [leads]);

  const viewedLeads = useMemo(() => {
    if (!status) return leads;
    return leads.filter((lead) => (lead.status || 'Not Contacted') === status);
  }, [leads, status]);

  const contactedCount = useMemo(
    () =>
      (statusCounts['Email 1 Sent'] || 0) +
      (statusCounts['Email 2 Sent'] || 0) +
      (statusCounts['Email 3 Sent'] || 0) +
      (statusCounts['Replied'] || 0),
    [statusCounts]
  );

  async function fetchLeads(searchTerm: string = search) {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);

    try {
      const res = await fetch(`/api/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load leads');
      const data = await res.json();
      if (currentFetchId === fetchIdRef.current) {
        setLeads(data.leads || []);
      }
    } catch (err: any) {
      if (currentFetchId === fetchIdRef.current) {
        setError(err?.message || 'Error loading leads');
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    fetchLeads(search);
  }, [search, token]);

  async function updateLead(id: string, updates: Partial<Lead>) {
    setNotice('');
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      setNotice('Update failed');
      return;
    }
    const data = await res.json().catch(() => null);
    const updatedLead = data?.lead as Lead | undefined;
    if (updatedLead?.id) {
      setLeads((prev) => prev.map((lead) => (lead.id === id ? updatedLead : lead)));
    } else {
      await fetchLeads(search);
    }
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  async function sendEmail(leadId: string, template: string) {
    const key = `${leadId}:${template}`;
    setSendingLeads((prev) => ({ ...prev, [key]: template }));
    setNotice('');
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lead_id: leadId, template })
      });
      if (res.status === 429) {
        setNotice('Daily send limit reached. Try again tomorrow.');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error || 'Failed to send email');
        return;
      }
      const statusMap: Record<string, string> = {
        email1: 'Email 1 Sent',
        email2: 'Email 2 Sent',
        email3: 'Email 3 Sent'
      };
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? { ...lead, status: statusMap[template] || lead.status, last_contacted: todayISO() }
            : lead
        )
      );
      setNotice(`Email sent successfully!`);
    } catch {
      setNotice('Network error — could not send email');
    } finally {
      setSendingLeads((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function convertToDeal(lead: Lead) {
    setConvertingLeads((prev) => ({ ...prev, [lead.id]: true }));
    setNotice('');
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lead_id: lead.id, company_name: lead.company_name })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error || 'Failed to create deal');
        return;
      }
      setNotice('Deal created!');
    } catch {
      setNotice('Network error — could not create deal');
    } finally {
      setConvertingLeads((prev) => {
        const next = { ...prev };
        delete next[lead.id];
        return next;
      });
    }
  }

  return (
    <div>
      <div className="toolbar">
        <input
          type="text"
          placeholder="Search company or city"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button className="secondary" onClick={() => fetchLeads(search)}>
          Refresh
        </button>
        <a href="/crm/import" className="ghost" style={{ padding: '8px 12px', borderRadius: 10, border: '1px dashed var(--accent)' }}>
          Import CSV
        </a>
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-label">Total Leads</div>
          <div className="dashboard-value">{leads.length}</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-label">Not Contacted</div>
          <div className="dashboard-value">{statusCounts['Not Contacted'] || 0}</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-label">Contacted</div>
          <div className="dashboard-value">{contactedCount}</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-label">Replied</div>
          <div className="dashboard-value">{statusCounts.Replied || 0}</div>
        </div>
        <div className="dashboard-card">
          <div className="dashboard-label">Do Not Contact</div>
          <div className="dashboard-value">{statusCounts['Do Not Contact'] || 0}</div>
        </div>
      </div>
      <div className="status-pills">
        <button
          className={`pill-filter ${status === '' ? 'active' : ''}`}
          onClick={() => setStatus('')}
          type="button"
        >
          All ({leads.length})
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            className={`pill-filter ${status === s ? 'active' : ''}`}
            onClick={() => setStatus(s)}
            type="button"
          >
            {s} ({statusCounts[s] || 0})
          </button>
        ))}
      </div>
      <p className="results-count">
        Showing {viewedLeads.length} lead{viewedLeads.length === 1 ? '' : 's'}
        {search ? ` for "${search}"` : ''}
      </p>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="notice">{error}</div> : null}

      {loading ? (
        <p>Loading leads...</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Summary</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {viewedLeads.length === 0 ? (
              <tr>
                <td colSpan={5} className="inline-meta">
                  No leads match this search/view.
                </td>
              </tr>
            ) : (
              viewedLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <button
                      onClick={() => setTimelineLeadId(lead.id)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontWeight: 700, fontSize: 'inherit', color: 'inherit', textDecoration: 'underline', textDecorationColor: '#e5e7eb' }}
                    >
                      {lead.company_name}
                    </button>
                    <div className="inline-meta">
                      {lead.city || '—'} {lead.zip || ''}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className="pill">{lead.category || 'Lead'}</span>
                      {lead.opens > 0 && (
                        <span title={`Opened ${lead.opens} time${lead.opens > 1 ? 's' : ''}`} style={{ fontSize: 11, color: '#6366f1', background: '#eef2ff', borderRadius: 6, padding: '2px 6px', cursor: 'default' }}>
                          👁 {lead.opens}
                        </span>
                      )}
                      {lead.clicked && (
                        <span title="Clicked a link" style={{ fontSize: 11, color: '#16a34a', background: '#f0fdf4', borderRadius: 6, padding: '2px 6px', cursor: 'default' }}>
                          🔗 Clicked
                        </span>
                      )}
                    </div>
                    {lead.website ? (
                      <div>
                        <a href={lead.website} target="_blank" rel="noreferrer">Website</a>
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {lead.email ? (
                      <div>{lead.email}</div>
                    ) : (
                      <div className="inline-meta">No email listed</div>
                    )}
                    {lead.contact_form_url ? (
                      <a href={lead.contact_form_url} target="_blank" rel="noreferrer">Contact form</a>
                    ) : null}
                  </td>
                  <td>
                    <select
                      value={lead.status || 'Not Contacted'}
                      onChange={(e) => updateLead(lead.id, { status: e.target.value })}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                      Last: {lead.last_contacted || '—'}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                      Next: {lead.next_follow_up || '—'}
                    </div>
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    {lead.summary || '—'}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => sendEmail(lead.id, 'email1')}
                        className="secondary"
                        disabled={!lead.email || !!sendingLeads[`${lead.id}:email1`]}
                      >
                        {sendingLeads[`${lead.id}:email1`] ? 'Sending...' : 'Send Email 1'}
                      </button>
                      <button
                        onClick={() => sendEmail(lead.id, 'email2')}
                        className="secondary"
                        disabled={!lead.email || !!sendingLeads[`${lead.id}:email2`]}
                      >
                        {sendingLeads[`${lead.id}:email2`] ? 'Sending...' : 'Send Email 2'}
                      </button>
                      <button
                        onClick={() => sendEmail(lead.id, 'email3')}
                        className="secondary"
                        disabled={!lead.email || !!sendingLeads[`${lead.id}:email3`]}
                      >
                        {sendingLeads[`${lead.id}:email3`] ? 'Sending...' : 'Send Email 3'}
                      </button>
                      <button
                        className="ghost"
                        onClick={() => updateLead(lead.id, { status: 'Replied' })}
                      >
                        Mark Replied
                      </button>
                      <button
                        className="ghost"
                        onClick={() => updateLead(lead.id, { status: 'Do Not Contact' })}
                      >
                        DNC
                      </button>
                      {lead.status === 'Replied' && (
                        <button
                          className="ghost"
                          onClick={() => convertToDeal(lead)}
                          disabled={!!convertingLeads[lead.id]}
                          style={{ color: '#16a34a', borderColor: '#bbf7d0' }}
                        >
                          {convertingLeads[lead.id] ? 'Converting...' : 'Convert to Deal'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
      {timelineLeadId && (
        <LeadTimeline
          leadId={timelineLeadId}
          token={token}
          onClose={() => setTimelineLeadId(null)}
        />
      )}
    </div>
  );
}
