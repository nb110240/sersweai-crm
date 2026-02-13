'use client';

import { useState } from 'react';

const STORAGE_KEY = 'leadcrm_password';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setNotice('');

    const token = window.localStorage.getItem(STORAGE_KEY);
    if (!token) {
      setNotice('Missing app password. Go back to login.');
      return;
    }
    if (!file) {
      setNotice('Choose a CSV file first.');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || 'Import failed');
      }
      setNotice(`Imported ${payload.inserted} leads.`);
      setFile(null);
    } catch (err: any) {
      setNotice(err?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-title">SersweAI CRM</div>
            <div className="brand-sub">Data intake</div>
          </div>
        </div>
        <div className="badge">CSV Import</div>
      </div>
      <div className="container">
        <div className="card">
          <h1>Import Leads</h1>
          <p className="tagline">Upload a CSV to add or update leads.</p>
          {notice ? <div className="notice">{notice}</div> : null}
          <form onSubmit={handleImport}>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div style={{ marginTop: 12 }}>
              <button type="submit" disabled={loading}>
                {loading ? 'Importing...' : 'Import CSV'}
              </button>
              <a href="/crm" style={{ marginLeft: 12 }}>Back to leads</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
