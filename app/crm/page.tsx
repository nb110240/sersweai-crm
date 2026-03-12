'use client';

import { useEffect, useState } from 'react';
import LeadTable from '../../components/LeadTable';
import CrmNav from '../../components/CrmNav';

export default function HomePage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  // On mount, check if cookie auth is valid
  useEffect(() => {
    fetch('/api/login', { method: 'GET' })
      .then((res) => {
        if (res.ok) setAuthed(true);
      })
      .finally(() => setLoading(false));
  }, []);

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
      // Cookie is set by server — no localStorage needed
      setAuthed(true);
      setPassword('');
    } catch (err: any) {
      setNotice(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    setAuthed(false);
  }

  if (loading) {
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
      </div>
    );
  }

  if (!authed) {
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
      <CrmNav current="/crm" subtitle="Pipeline" onLogout={handleLogout} />
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
          <LeadTable />
        </div>
      </div>
    </div>
  );
}
