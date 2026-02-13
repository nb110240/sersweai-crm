'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'leadcrm_password';

type Contact = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  interest: string | null;
  message: string | null;
  source: string | null;
  created_at: string;
};

export default function ContactsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchContacts();
  }, [token]);

  async function fetchContacts() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/contacts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load contacts');
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (err: any) {
      setError(err?.message || 'Error loading contacts');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  if (!token) {
    return (
      <div className="app-shell">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark" />
            <div>
              <div className="brand-title">SersweAI CRM</div>
              <div className="brand-sub">Website contacts</div>
            </div>
          </div>
        </div>
        <div className="container login">
          <div className="card">
            <h1>Unauthorized</h1>
            <p className="tagline">
              Please <a href="/crm">log in from the main dashboard</a> first.
            </p>
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
            <div className="brand-sub">Website contacts</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/crm" style={{ fontSize: 13, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
            &larr; Pipeline
          </a>
          <div className="badge">Website Contacts</div>
        </div>
      </div>
      <div className="container">
        <div className="header">
          <div>
            <h1>Website Contacts</h1>
            <p className="tagline">
              People who submitted the contact form on sersweai.com
            </p>
          </div>
          <button onClick={fetchContacts} className="secondary">
            Refresh
          </button>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="dashboard-label">Total Contacts</div>
            <div className="dashboard-value">{contacts.length}</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-label">This Week</div>
            <div className="dashboard-value">
              {contacts.filter(c => {
                const d = new Date(c.created_at);
                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return d >= weekAgo;
              }).length}
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-label">With Company</div>
            <div className="dashboard-value">
              {contacts.filter(c => c.company_name).length}
            </div>
          </div>
        </div>

        {error ? <div className="notice">{error}</div> : null}

        <div className="card">
          {loading ? (
            <p>Loading contacts...</p>
          ) : contacts.length === 0 ? (
            <p className="tagline">No website contacts yet. They will appear here when someone submits the form on sersweai.com.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Interest</th>
                  <th>Message</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.full_name}</strong>
                      <div><a href={`mailto:${c.email}`}>{c.email}</a></div>
                      {c.phone ? (
                        <div className="inline-meta">
                          <a href={`tel:${c.phone}`}>{c.phone}</a>
                        </div>
                      ) : null}
                    </td>
                    <td>{c.company_name || <span className="inline-meta">—</span>}</td>
                    <td>
                      {c.interest ? (
                        <span className="pill">{c.interest}</span>
                      ) : (
                        <span className="inline-meta">—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      {c.message || <span className="inline-meta">—</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="inline-meta">{formatDate(c.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
