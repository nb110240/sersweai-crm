'use client';

const NAV_ITEMS = [
  { href: '/crm', label: 'Pipeline' },
  { href: '/crm/dashboard', label: 'Dashboard' },
  { href: '/crm/deals', label: 'Deals' },
  { href: '/crm/calendar', label: 'Calendar' },
  { href: '/crm/contacts', label: 'Contacts' },
];

type Props = {
  current: string;
  subtitle?: string;
  onLogout?: () => void;
};

export default function CrmNav({ current, subtitle, onLogout }: Props) {
  return (
    <nav className="topbar" aria-label="CRM navigation">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true" />
        <div>
          <div className="brand-title">SersweAI CRM</div>
          <div className="brand-sub">{subtitle || 'Local business outreach'}</div>
        </div>
      </div>
      <div className="nav-links">
        {NAV_ITEMS.map(item => (
          <a
            key={item.href}
            href={item.href}
            className={`nav-link${item.href === current ? ' active' : ''}`}
            aria-current={item.href === current ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
        {onLogout && (
          <button
            onClick={onLogout}
            className="nav-link"
            type="button"
            style={{ cursor: 'pointer' }}
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
