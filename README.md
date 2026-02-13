# Lead CRM (Solo)

A lightweight solo CRM for cold outreach with CSV import, email sending, and open/click tracking.

## 1) Supabase setup

1. Create a Supabase project.
2. Run the SQL in `supabase/schema.sql` in the SQL editor.
3. Grab your Project URL and Service Role Key.

## 2) Email sending (optional for now)

Email sending is paused until your sending domain is verified. You can still track outreach by manually marking email status in the app.

When ready:

1. Create a Resend account.
2. Verify your sending domain.
3. Create an API key.

## 3) Configure env

Create `.env.local` with:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
APP_PASSWORD=
APP_BASE_URL=
SENDER_NAME=
SENDER_EMAIL=
BOOKING_URL=
```

Notes:
- `APP_PASSWORD` is required for login.
- `APP_BASE_URL` should be your Vercel URL in production.
- `BOOKING_URL` is optional (enables tracked calendar link).

## 4) Install dependencies

```
npm install
```

## 5) Run locally

```
npm run dev
```

## 6) Import leads

Use the UI “Import CSV” and upload:

`output/spreadsheet/sd_leads_law_accounting_hubspot.csv`

## 7) Deploy to Vercel

When ready, deploy the `lead-crm` folder.
