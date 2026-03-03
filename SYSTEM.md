# SersweAI CRM — System Documentation

> Last updated: March 2026
> Stack: Next.js 14 · Supabase · Resend · n8n (Railway) · Google Maps Places API · Hunter.io · OpenAI

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Daily Automated Flow](#daily-automated-flow)
3. [Lead Lifecycle](#lead-lifecycle)
4. [n8n Workflows](#n8n-workflows)
5. [CRM Pages](#crm-pages)
6. [API Routes](#api-routes)
7. [Database Schema](#database-schema)
8. [Environment Variables](#environment-variables)
9. [Daily Operations Checklist](#daily-operations-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
6:00 AM PT                    7:00 AM PT
     │                              │
     ▼                              ▼
n8n: Daily Lead Gen          n8n: Daily Auto-Send
     │                              │
     ├─ Google Maps Places API      ├─ GET /api/leads
     ├─ Website scraper             ├─ Eligibility filter
     ├─ Hunter.io fallback          ├─ POST /api/send (per lead)
     ├─ OpenAI GPT-4o-mini          └─ Resend email delivery
     └─ POST /api/import                   │
              │                            ▼
              ▼                     Supabase: emails table
       Supabase: leads table        Lead status updated
```

**Key services and their roles:**

| Service | Role | Cost |
|---------|------|------|
| Google Maps Places API | Find San Diego businesses by category | ~$0/mo (free credit) |
| Hunter.io | Email lookup fallback when scraping fails | Free (25 searches/mo) |
| OpenAI GPT-4o-mini | Personalized email opener per lead | ~$0.01/day |
| Resend | Email delivery | Free (100 emails/day) |
| Supabase | Database (leads + emails) | Free tier |
| n8n on Railway | Workflow automation | ~$5/mo |
| Vercel | Hosts the Next.js CRM | Free tier |

---

## Daily Automated Flow

### 6:00 AM PT — Lead Gen Workflow (`9R0ryPZws78De6iT`)

**Step 1: Determine today's category + neighborhood**
- Rotates through 8 business categories (one per day):
  1. Health & Wellness
  2. Real Estate
  3. Technology
  4. Food & Beverage
  5. Retail
  6. Home Services
  7. Beauty & Fitness
  8. Creative & Media
- Rotates through 8 San Diego neighborhoods (changes every 8 days):
  1. Downtown San Diego
  2. Mission Valley
  3. La Jolla
  4. North Park
  5. Chula Vista
  6. El Cajon
  7. Oceanside
  8. Encinitas
- **64 unique category × neighborhood combinations** before repeating

**Step 2: Google Maps Places API**
- POST to `https://places.googleapis.com/v1/places:searchText`
- 10km radius around neighborhood center
- Up to 20 results
- Field mask: name, address, website, business type, status, rating, review count

**Step 3: Filter + Normalize**
- Removes non-operational businesses
- Excludes: CPAs, lawyers, accountants (hard to sell automation to)
- Extracts zip code and city from formatted address

**Step 4: Email Scraping (per lead)**
- Tries 7 URLs in order: homepage, /contact, /contact-us, /about, /about-us, /team, /get-in-touch
- Extracts emails via: JSON-LD structured data → mailto: links → regex scan
- Deobfuscates: "info [at] company [dot] com" patterns
- Prefers: info@, hello@, contact@, team@ over generic matches
- Filters junk: noreply, no-reply, placeholder, sentry, w3.org, image filenames

**Step 5: Hunter.io Fallback**
- If scraping finds no email, queries Hunter.io domain search API
- Returns highest-confidence email for the domain
- API key: free tier (25 searches/month)

**Step 6: AI Opener Generation**
- Sends company name + category + city to GPT-4o-mini
- Returns 1–2 personalized warm sentences referencing their industry
- Stored in the lead's `notes` field — used as email opener

**Step 7: Filter no-email leads**
- Any lead without an email is dropped entirely
- Only leads with confirmed emails are imported

**Step 8: Import to CRM**
- POSTs CSV as JSON to `POST /api/import`
- Upserts on `(company_name, zip)` — no duplicates
- New leads get status: `Not Contacted`

---

### 7:00 AM PT — Auto-Send Workflow (`Zv69OBAniv7tb0xs`)

**Step 1: Fetch all leads**
- GET `/api/leads` with Bearer auth

**Step 2: Eligibility filter**
- Skips weekends (Saturday / Sunday)
- Eligible conditions:
  - Status = `Not Contacted` → send Email 1
  - Status = `Email 1 Sent` AND `next_follow_up` ≤ today → send Email 2
  - Status = `Email 2 Sent` AND `next_follow_up` ≤ today → send Email 3
- Caps at **50 emails per day**

**Step 3: Send each email**
- POST `/api/send` with `lead_id` + `template` (email1 / email2 / email3)
- `/api/send` does its own rate limit check (50/day hard cap)
- Resend delivers the email immediately
- Lead status updated, `last_contacted` set, `next_follow_up` calculated

**Follow-up timing (category-aware):**

Default intervals are +3 / +7 days, but vary by category:

| Category | Email 1 → Email 2 | Email 2 → Email 3 |
|----------|-------------------|-------------------|
| Technology | +2 days | +5 days |
| Real Estate | +4 days | +10 days |
| Health & Wellness | +3 days | +7 days |
| Insurance | +3 days | +7 days |
| Dental & Medical | +3 days | +7 days |
| Legal (Solo/Small) | +3 days | +7 days |
| Financial Advisors | +3 days | +8 days |
| Property Management | +3 days | +7 days |
| Veterinary | +3 days | +7 days |
| Beauty & Fitness | +2 days | +5 days |
| Home Services | +2 days | +5 days |
| Creative & Media | +3 days | +7 days |
| Retail | +3 days | +7 days |
| Food & Beverage | +3 days | +7 days |
| *Other (default)* | +3 days | +7 days |

Email 3 completes the sequence — no further follow-up.

---

## Lead Lifecycle

```
Day 0   → Imported as "Not Contacted" (has email + AI opener in notes)
Day 1   → Auto-send fires Email 1 → status: "Email 1 Sent" → follow-up: +2–4 days (varies by category)
Day 3–5 → Auto-send fires Email 2 → status: "Email 2 Sent" → follow-up: +5–10 days (varies by category)
Day 8–15→ Auto-send fires Email 3 → status: "Email 3 Sent" → sequence complete

No reply → Lead stays at "Email 3 Sent" — mark "Not Fit" if you want to clean up
Reply    → Manually update to "Replied" → you take over from here
```

**Status meanings:**

| Status | Meaning | Auto-send behavior |
|--------|---------|-------------------|
| Not Contacted | Just imported, no emails sent | Will send Email 1 |
| Email 1 Sent | First email sent | Will send Email 2 after 2–4 days (by category) |
| Email 2 Sent | Second email sent | Will send Email 3 after 5–10 days (by category) |
| Email 3 Sent | Full sequence complete | No more auto emails |
| Replied | They responded! | Skipped by auto-send |
| Not Fit | Wrong target or dead end | Skipped by auto-send |
| Do Not Contact | Explicitly opted out | Skipped by auto-send |

---

## n8n Workflows

### Daily Lead Gen — `9R0ryPZws78De6iT`
- **Trigger:** Every day at 6:00 AM PT (Schedule node) + webhook at `/crm-leadgen` (manual trigger)
- **Node sequence:**
  1. Schedule Trigger / Manual Trigger
  2. Determine Category (Code)
  3. Google Maps Places (HTTP Request)
  4. Filter + Normalize (Code)
  5. Fetch Emails (Code — async scraping + Hunter.io)
  6. Generate Opener (HTTP Request → OpenAI)
  7. Add Opener to Lead (Code)
  8. Build CSV (Code — filters no-email leads)
  9. Import to CRM (HTTP Request → `/api/import`)

### Daily Auto-Send — `Zv69OBAniv7tb0xs`
- **Trigger:** Every day at 7:00 AM PT
- **Node sequence:**
  1. Schedule Trigger
  2. Fetch Leads (HTTP Request → `/api/leads`)
  3. Select Eligible Leads (Code)
  4. Send Email (HTTP Request → `/api/send`, one per lead)

---

## CRM Pages

| Page | URL | Purpose |
|------|-----|---------|
| Pipeline | `/crm` | Full lead table — search, filter, manual send, status update |
| Dashboard | `/crm/dashboard` | Live stats: funnel, quota bar, recent sends, reply rate |
| Calendar | `/crm/calendar` | Follow-ups by date — see what auto-send will pick up |

### Dashboard metrics to monitor:
- **Added Today** — confirms lead gen ran
- **Emails Sent Today** — confirms auto-send ran (X / 50)
- **Replied** — your conversion metric
- **Outreach Funnel** — pipeline health at a glance
- **Recent Sends** — spot-check that real companies are being emailed

---

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/login` | Validate app password |
| GET | `/api/leads` | Fetch all leads (auth required) |
| POST | `/api/send` | Send email to a lead (auth required, 50/day cap) |
| POST | `/api/import` | Bulk import leads via CSV or JSON (auth required) |
| GET | `/api/stats` | Dashboard stats — lead counts + email metrics |
| GET | `/api/track/[emailId]` | Pixel tracking for open events |
| GET | `/api/unsubscribe/[leadId]` | One-click unsubscribe handler |

All authenticated routes require: `Authorization: Bearer <APP_PASSWORD>`

---

## Database Schema

### `leads` table
```sql
id              uuid (PK)
company_name    text
category        text
zip             text
city            text
website         text
email           text
contact_form_url text
summary         text
source_url      text
notes           text          -- AI-generated opener
status          text          -- see Status meanings above
last_contacted  date
next_follow_up  date          -- drives calendar + auto-send eligibility
created_at      timestamptz
```

### `emails` table
```sql
id          uuid (PK)
lead_id     uuid (FK → leads.id)
template    text              -- email1, email2, email3
subject     text
body        text
to_email    text
message_id  text              -- Resend message ID
sent_at     timestamptz
```

---

## Environment Variables

Set in Vercel (production) and `.env.local` (local dev):

```
SUPABASE_URL=                  # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=     # Supabase service role key (bypasses RLS)
APP_PASSWORD=                  # Password to log into CRM
APP_BASE_URL=                  # https://sersweai.com
RESEND_API_KEY=                # Resend API key
SENDER_NAME=                   # Display name on outgoing emails
SENDER_EMAIL=                  # From address (must be verified in Resend)
BOOKING_URL=                   # TidyCal booking link (used in email templates)
```

Set in n8n (as workflow environment variables):
```
CRM_APP_PASSWORD=              # Same as APP_PASSWORD
CRM_BASE_URL=                  # https://sersweai.com
GOOGLE_MAPS_API_KEY=           # Google Cloud Places API (New) key
HUNTER_API_KEY=                # Hunter.io free API key
```

---

## Daily Operations Checklist

### Every morning (2 minutes)

1. **Open `/crm/dashboard`**
   - ✅ Added Today > 0 → lead gen worked
   - ✅ Emails Sent Today > 0 → auto-send worked
   - ✅ Recent Sends shows real company names
   - 🚨 If either is 0 → check n8n (see Troubleshooting)

2. **Check Replied count**
   - If it increased → go to `/crm`, filter by Replied, respond personally

3. **Done** — everything else is automated

### When someone replies

1. Read their email carefully
2. Go to `/crm` → find the company → read the `notes` field for context
3. Reply personally — reference what you know about their business
4. Book a discovery call: share your TidyCal link
5. Update lead status to `Replied` if not already set

### Weekly (5 minutes, Friday)

- Check Dashboard → Replied rate (target: 2–5% reply rate over time)
- Scan Recent Sends — are the companies relevant? Any obvious bad fits?
- Mark obvious dead leads as `Not Fit` to keep pipeline clean

---

## Troubleshooting

### Lead gen didn't run (Added Today = 0)

1. Go to n8n → open `SersweAI Daily Lead Gen`
2. Check execution history — look for errors
3. Common causes:
   - Google Maps API key expired / quota hit → check Google Cloud Console
   - All leads found had no email (rare) → workflow exits early (this is correct behavior)
   - n8n Railway instance went to sleep → click "Execute Workflow" to run manually

### Auto-send didn't fire (Emails Sent Today = 0)

1. Go to n8n → open `SersweAI Daily Auto-Send`
2. Check execution history
3. Common causes:
   - It's a weekend (Saturday/Sunday) → expected, no emails sent
   - No eligible leads (all leads have future follow-up dates) → pipeline is fresh, normal in first week
   - `/api/send` returned 429 (daily limit hit from manual sends) → cap already reached

### Emails going to wrong people / bad leads

1. Go to `/crm` → filter by status
2. Mark bad leads as `Not Fit` or `Do Not Contact`
3. Auto-send will skip them immediately on next run

### Duplicate leads appearing

- Upsert logic deduplicates on `(company_name, zip)` — exact match only
- If same company appears with slightly different name spelling, mark one as `Not Fit`

### Hunter.io returning no emails

- Free tier: 25 domain searches/month
- Check usage at hunter.io dashboard
- If exhausted, scraper still runs — it's the primary method, Hunter is fallback only

### Email deliverability issues

- Check Resend dashboard for bounces / spam complaints
- Verify `SENDER_EMAIL` domain has SPF + DKIM records set up in Resend
- If reply rates drop: review email templates in `lib/templates.ts`
