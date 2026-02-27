'use client';

import { useEffect, useState } from 'react';

type TimelineEvent = {
  type: 'email_sent' | 'open' | 'click' | 'replied';
  date: string;
  template?: string;
  subject?: string;
  url?: string | null;
  reply_type?: string | null;
  email_id?: string;
};

type Lead = {
  id: string;
  company_name: string;
  email: string | null;
  status: string | null;
  category: string | null;
  city: string | null;
  website: string | null;
  reply_type: string | null;
};

type Props = {
  leadId: string;
  token: string;
  onClose: () => void;
};

const TEMPLATE_LABEL: Record<string, string> = {
  email1: 'Email 1',
  email2: 'Email 2',
  email3: 'Email 3',
};

const REPLY_TYPE_COLOR: Record<string, string> = {
  interested: '#16a34a',
  not_interested: '#dc2626',
  out_of_office: '#d97706',
  needs_followup: '#7c3aed',
};

export default function LeadTimeline({ leadId, token, onClose }: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leads/${leadId}/timeline`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setLead(data.lead);
        setTimeline(data.timeline || []);
        setLoading(false);
      });
  }, [leadId, token]);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function eventIcon(type: string) {
    if (type === 'email_sent') return '📧';
    if (type === 'open') return '👁';
    if (type === 'click') return '🔗';
    if (type === 'replied') return '💬';
    return '•';
  }

  function eventLabel(ev: TimelineEvent) {
    if (ev.type === 'email_sent') return `${TEMPLATE_LABEL[ev.template || ''] || 'Email'} sent`;
    if (ev.type === 'open') return `Opened ${TEMPLATE_LABEL[ev.template || ''] || 'email'}`;
    if (ev.type === 'click') return `Clicked link${ev.url ? ` → ${new URL(ev.url).hostname}` : ''}`;
    if (ev.type === 'replied') return `Replied${ev.reply_type ? ` (${ev.reply_type.replace(/_/g, ' ')})` : ''}`;
    return ev.type;
  }

  function eventColor(type: string) {
    if (type === 'email_sent') return '#3b82f6';
    if (type === 'open') return '#6366f1';
    if (type === 'click') return '#16a34a';
    if (type === 'replied') return '#f59e0b';
    return '#9ca3af';
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100, backdropFilter: 'blur(2px)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: 'white', zIndex: 101, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{lead?.company_name || '...'}</div>
            {lead && (
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                {lead.category} · {lead.city}
              </div>
            )}
            {lead?.email && (
              <div style={{ fontSize: 12, color: '#6366f1', marginTop: 4 }}>{lead.email}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Status badge */}
        {lead?.status && (
          <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Status:</span>
            <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, background: '#f3f4f6', fontWeight: 600 }}>{lead.status}</span>
            {lead.reply_type && (
              <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, background: '#f0fdf4', color: REPLY_TYPE_COLOR[lead.reply_type] || '#374151', fontWeight: 600 }}>
                {lead.reply_type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        )}

        {/* Timeline */}
        <div style={{ padding: '20px 24px', flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timeline</div>

          {loading && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading...</p>}

          {!loading && timeline.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '40px 0' }}>
              No activity yet
            </div>
          )}

          {!loading && timeline.length > 0 && (
            <div style={{ position: 'relative' }}>
              {/* Vertical line */}
              <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: '#f3f4f6' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {timeline.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: 20, position: 'relative' }}>
                    {/* Dot */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: eventColor(ev.type) + '18',
                      border: `2px solid ${eventColor(ev.type)}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0, position: 'relative', zIndex: 1,
                    }}>
                      {eventIcon(ev.type)}
                    </div>

                    {/* Content */}
                    <div style={{ paddingTop: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{eventLabel(ev)}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{formatDate(ev.date)}</div>
                      {ev.type === 'email_sent' && ev.subject && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>"{ev.subject}"</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer links */}
        {lead?.website && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
            <a href={lead.website} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#6366f1' }}>
              Visit website →
            </a>
          </div>
        )}
      </div>
    </>
  );
}
