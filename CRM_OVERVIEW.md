# SersweAI CRM — Complete Overview

## What It Is
A fully automated, solo outbound sales CRM built on **Next.js + Supabase + Resend + n8n**, hosted on Railway/Vercel. Every part of the pipeline — from finding leads to sending emails to detecting replies — runs without manual intervention.

---

## The Pipeline (7 Lead Stages)

| Stage | What It Means |
|---|---|
| **Not Contacted** | Just imported, no emails sent yet |
| **Email 1 Sent** | First cold email sent, follow-up in 2–4 days (by category) |
| **Email 2 Sent** | Second email sent, follow-up in 5–10 days (by category) |
| **Email 3 Sent** | Full sequence complete |
| **Replied** | Responded — auto-send skips them |
| **Not Fit** | Wrong target — skipped |
| **Do Not Contact** | Opted out — skipped permanently |

Follow-ups automatically land on the next business day — weekends are skipped.

---

## The 3-Email Sequence

- **Email 1 — "Quick idea for [Firm]"** — Opens with an AI-written personalized hook, introduces SersweAI, asks for a 30-minute call
- **Email 2 — "2 automations that could help [Firm]"** — Specific workflow examples (smart intake, document collection), value-first follow-up
- **Email 3 — "Closing the loop — [Firm]"** — Final soft touch, offers a free 1-page workflow suggestion, no pressure close

All emails are scheduled for **next business day at 8am PT**, tracked for opens and clicks.

---

## The 4 CRM Pages

**`/crm` — Pipeline Table**
The main working view. Shows all leads in a searchable, filterable table with 7 status filter pills. Each row shows company, email, status dropdown, next follow-up date, summary, and manual send buttons for Email 1/2/3. You can mark a lead Replied or DNC in one click.

**`/crm/dashboard` — Live Stats**
- 5 KPI cards: Total leads, added today, emails sent today (X/50 quota bar), sent this week broken down by Email 1/2/3, and total replies + reply rate
- Outreach funnel — bar chart of every status with lead counts
- 8 most recent sends with company, category, template badge, and time sent
- Automation status banner showing schedule

**`/crm/calendar` — Follow-Up Calendar**
Interactive monthly calendar. Each day shows colored pills for leads scheduled that day. Click a day to see every lead due with their next action (Send Email 1, Send Email 2, etc.), email link, website, and a view button.

**`/crm/contacts` — Website Inquiries**
Inbound leads from the sersweai.com contact form. Shows name, email, phone, company, message, and submission time. Separate from the cold outreach pipeline.

---

## The Automation Stack (n8n)

**Daily Lead Gen — 6am PT**
Scrapes Google Maps for local San Diego businesses (rotates across 8 categories × 8 neighborhoods), scrapes their website + contact page for emails, cross-checks Hunter.io, generates a GPT-4o personalized opener, and imports everything into the CRM. Sends a Telegram summary when done: leads imported + how many had emails.

**Daily Auto-Send — 7am PT**
Fetches all leads, prioritizes Email 2/3 follow-ups before any new Email 1s, scores new outreach by Google rating, review count, and category (Tech/Real Estate ranked highest), sends up to 50 emails, then fires a Telegram summary. Skips weekends automatically.

**Reply Detector — every 5 minutes**
Polls Gmail for replies with "Re:" in the subject, matches the sender email against your lead database, sends the reply snippet to GPT-4o for classification (interested / not interested / out of office / needs follow-up), updates the lead status and reply_type in the CRM, and sends a Telegram alert instantly.

---

## Tracking
Every email has an invisible **open tracking pixel** and **click-tracked links**. Opens and clicks are logged to the database against each lead and email record.

---

## Tech Stack
Next.js 14 · TypeScript · Supabase (PostgreSQL) · Resend · n8n · Railway · Vercel
