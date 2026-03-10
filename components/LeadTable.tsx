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

type Props = Record<string, never>;

const CATEGORIES = [
  'Health & Wellness',
  'Real Estate',
  'Technology',
  'Beauty & Fitness',
  'Home Services',
  'Creative & Media',
  'Retail',
  'Food & Beverage',
  'Insurance',
  'Dental & Medical',
  'Property Management',
  'Financial Advisors',
  'Veterinary',
  'Legal (Solo/Small)',
];

const STATUS_OPTIONS = [
  'Not Contacted',
  'Email 1 Sent',
  'Email 2 Sent',
  'Email 3 Sent',
  'Email 4 Sent',
  'Replied',
  'Not Fit',
  'Do Not Contact'
];

export default function LeadTable(_props: Props) {
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
  const [contactFormOnly, setContactFormOnly] = useState(false);
  const fetchIdRef = useRef(0);

  // Discover state
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverLocation, setDiscoverLocation] = useState('San Diego, CA');
  const [discoverCategory, setDiscoverCategory] = useState('');
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<{ discovered: number; imported: number; skipped: number; remaining_searches: number | null } | null>(null);
  const [searchesRemaining, setSearchesRemaining] = useState<number | null>(null);

  // Enrich state
  const [enrichingLeads, setEnrichingLeads] = useState<Record<string, boolean>>({});
  const [enrichingAll, setEnrichingAll] = useState(false);

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
    if (contactFormOnly) params.set('contact_form_only', 'true');

    try {
      const res = await fetch(`/api/leads?${params.toString()}`, {
        headers: {}
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
  }, [search, contactFormOnly]);

  async function updateLead(id: string, updates: Partial<Lead>) {
    setNotice('');
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: {
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
        email3: 'Email 3 Sent',
        email4: 'Email 4 Sent',
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

  async function fetchSearchesRemaining() {
    try {
      const res = await fetch('/api/discover');
      if (res.ok) {
        const data = await res.json();
        setSearchesRemaining(data.searches_remaining ?? null);
      }
    } catch { /* ignore */ }
  }

  async function runDiscover() {
    if (!discoverQuery.trim()) return;
    setDiscoverLoading(true);
    setDiscoverResult(null);
    setNotice('');
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: discoverQuery.trim(),
          location: discoverLocation.trim() || 'San Diego, CA',
          category: discoverCategory || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error || 'Discovery failed');
        return;
      }
      const data = await res.json();
      setDiscoverResult(data);
      if (data.remaining_searches !== null && data.remaining_searches !== undefined) {
        setSearchesRemaining(data.remaining_searches);
      }
      if (data.imported > 0) {
        fetchLeads(search);
      }
    } catch {
      setNotice('Network error — could not run discovery');
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function enrichSingleLead(leadId: string) {
    setEnrichingLeads((prev) => ({ ...prev, [leadId]: true }));
    setNotice('');
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: [leadId] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error || 'Enrichment failed');
        return;
      }
      const data = await res.json();
      if (data.enriched > 0) {
        setNotice('Lead enriched with personalized opener!');
        fetchLeads(search);
      } else {
        setNotice('Could not enrich — no website or content found.');
      }
    } catch {
      setNotice('Network error — could not enrich lead');
    } finally {
      setEnrichingLeads((prev) => {
        const next = { ...prev };
        delete next[leadId];
        return next;
      });
    }
  }

  async function enrichNotContacted() {
    const targets = leads.filter(
      (l) => (l.status === 'Not Contacted') && l.website && !l.notes
    );
    if (targets.length === 0) {
      setNotice('No un-enriched "Not Contacted" leads with websites found.');
      return;
    }
    const batch = targets.slice(0, 20);
    setEnrichingAll(true);
    setNotice(`Enriching ${batch.length} leads...`);
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: batch.map((l) => l.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error || 'Bulk enrichment failed');
        return;
      }
      const data = await res.json();
      setNotice(`Enriched ${data.enriched} leads, ${data.skipped} skipped, ${data.failed} failed.`);
      if (data.enriched > 0) fetchLeads(search);
    } catch {
      setNotice('Network error — could not enrich leads');
    } finally {
      setEnrichingAll(false);
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
        <button
          className="ghost"
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px dashed #6366f1', color: '#6366f1' }}
          onClick={() => { setDiscoverOpen((v) => !v); if (!discoverOpen) fetchSearchesRemaining(); }}
        >
          Discover Leads
        </button>
        <button
          className="ghost"
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px dashed #f59e0b', color: '#f59e0b' }}
          onClick={enrichNotContacted}
          disabled={enrichingAll}
        >
          {enrichingAll ? 'Enriching...' : 'Enrich All'}
        </button>
      </div>
      {discoverOpen && (
        <div style={{ margin: '12px 0', padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface, #fff)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>Discover Leads via Google Maps</strong>
            {searchesRemaining !== null && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {searchesRemaining} searches remaining this month
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Query</label>
              <input
                type="text"
                placeholder="e.g. dentists, law firms"
                value={discoverQuery}
                onChange={(e) => setDiscoverQuery(e.target.value)}
                style={{ width: 200 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Location</label>
              <input
                type="text"
                placeholder="San Diego, CA"
                value={discoverLocation}
                onChange={(e) => setDiscoverLocation(e.target.value)}
                style={{ width: 180 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Category</label>
              <select
                value={discoverCategory}
                onChange={(e) => setDiscoverCategory(e.target.value)}
                style={{ width: 180 }}
              >
                <option value="">Auto-detect</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button
              onClick={runDiscover}
              disabled={discoverLoading || !discoverQuery.trim()}
              style={{ height: 38 }}
            >
              {discoverLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
          {discoverResult && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: discoverResult.imported > 0 ? '#f0fdf4' : '#fef9c3', fontSize: 13 }}>
              Found <strong>{discoverResult.discovered}</strong> businesses
              {' — '}
              <strong>{discoverResult.imported}</strong> new lead{discoverResult.imported !== 1 ? 's' : ''} imported,
              {' '}{discoverResult.skipped} duplicate{discoverResult.skipped !== 1 ? 's' : ''} skipped.
            </div>
          )}
        </div>
      )}
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
        <button
          className={`pill-filter ${contactFormOnly ? 'active' : ''}`}
          onClick={() => setContactFormOnly((v) => !v)}
          type="button"
        >
          Contact Form Only
        </button>
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
                    {lead.notes && (
                      <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 500, marginBottom: 4 }}>
                        {lead.notes}
                      </div>
                    )}
                    {lead.summary || '—'}
                  </td>
                  <td>
                    <div className="row-actions">
                      {lead.website && !lead.notes && (
                        <button
                          onClick={() => enrichSingleLead(lead.id)}
                          className="secondary"
                          disabled={!!enrichingLeads[lead.id]}
                          style={{ color: '#f59e0b', borderColor: '#fde68a' }}
                        >
                          {enrichingLeads[lead.id] ? 'Enriching...' : 'Enrich'}
                        </button>
                      )}
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
                      {lead.status === 'Email 3 Sent' && (
                        <button
                          onClick={() => sendEmail(lead.id, 'email4')}
                          className="secondary"
                          disabled={!lead.email || !!sendingLeads[`${lead.id}:email4`]}
                        >
                          {sendingLeads[`${lead.id}:email4`] ? 'Sending...' : 'Send Email 4'}
                        </button>
                      )}
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
                      {!lead.email && lead.contact_form_url && (
                        <button
                          className="secondary"
                          onClick={() => {
                            const msg = `Hi, I'm Neil from SersweAI. We help ${lead.category || 'local'} businesses save time by automating repetitive admin work. Would you be open to a quick call to discuss how we could help ${lead.company_name}? You can learn more at sersweai.com`;
                            navigator.clipboard.writeText(msg);
                            window.open(lead.contact_form_url!, '_blank');
                            updateLead(lead.id, { status: 'Email 1 Sent' });
                            setNotice('Message copied to clipboard — paste it in the contact form!');
                          }}
                          style={{ color: '#7c3aed', borderColor: '#c4b5fd' }}
                        >
                          Reach Out
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
          onClose={() => setTimelineLeadId(null)}
        />
      )}
    </div>
  );
}
