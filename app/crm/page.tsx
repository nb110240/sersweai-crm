'use client';

import { useEffect, useMemo, useState } from 'react';
import LeadTable from '../../components/LeadTable';

const STORAGE_KEY = 'leadcrm_password';

export default function HomePage() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setToken(saved);
    }
  }, []);

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
      if (!res.ok) {
        throw new Error('Invalid password');
      }
      window.localStorage.setItem(STORAGE_KEY, password);
      setToken(password);
      setPassword('');
    } catch (err: any) {
      setNotice(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthed) {
    return (
      <div className="app-shell">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark" />
            <div>
              <div className="brand-title">SersweAI CRM</div>
              <div className="brand-sub">Local business outreach</div>
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
                onChange={(e) => setPassword(e.target.value)}
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
            <div className="brand-sub">Solo outreach workspace</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="/crm/contacts" style={{ fontSize: 13, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
            Website Contacts &rarr;
          </a>
          <div className="badge">CRM · MVP</div>
        </div>
      </div>
      <div className="container">
        <div className="header">
          <div>
            <h1>Pipeline Overview</h1>
            <p className="tagline">
              Track law + accounting leads across San Diego and North County.
            </p>
          </div>
        </div>

        <div className="card">
          <LeadTable token={token as string} />
        </div>
      </div>
    </div>
  );
}
