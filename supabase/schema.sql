-- Enable UUID generation
create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  category text,
  zip text,
  city text,
  website text,
  email text,
  contact_form_url text,
  summary text,
  source_url text,
  status text default 'Not Contacted',
  last_contacted date,
  next_follow_up date,
  reply_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_name, zip)
);

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_company_name_idx on public.leads (company_name);

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  template text not null,
  subject text not null,
  body text not null,
  to_email text not null,
  message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists emails_lead_idx on public.emails (lead_id);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references public.emails(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  event_type text not null,
  url text,
  created_at timestamptz not null default now()
);

create index if not exists email_events_lead_idx on public.email_events (lead_id);
create index if not exists email_events_email_idx on public.email_events (email_id);

-- Website contact form submissions (from sersweai.com)
create table if not exists public.website_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  company_name text,
  interest text,
  message text,
  source text default 'sersweai.com',
  created_at timestamptz not null default now()
);

create index if not exists website_contacts_created_idx on public.website_contacts (created_at desc);
create index if not exists website_contacts_email_idx on public.website_contacts (email);

-- Trigger to update updated_at on leads
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_updated_at
before update on public.leads
for each row
execute procedure public.set_updated_at();
