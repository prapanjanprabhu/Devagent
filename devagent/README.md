# Devagent

Multi-tenant AI front desk for appointment/order businesses: WhatsApp + web booking, calendar, deposits,
reminders, waitlist, orders, enquiry pipeline, classes & packs, campaigns, grow agent, Call Rescue, analytics.
Design basis and evidence: [docs/ANALYSIS.md](docs/ANALYSIS.md).

## Run
```
npm install
copy .env.example .env.local     # then edit
npm run dev -- -p 3100           # or: npm run build && npm start -- -p 3100
```
Needs Node >= 22.13 (uses built-in `node:sqlite`). Data: `./data/devagent.db` (override with `DATA_DIR`).
Sign up at `/signup`, describe your business at `/onboarding`, share `/book/<id>` or the widget snippet on the dashboard.

## What needs your own accounts (works without them in logged-only mode)
| Feature | Needs |
|---|---|
| AI chat agent + AI onboarding | `ANTHROPIC_API_KEY` (otherwise rule-based fallback) |
| Real WhatsApp send/receive | Meta WhatsApp Cloud API: per-business phone-number ID + token in **Connect**; webhook `/api/whatsapp`; set `WA_APP_SECRET` in production |
| Online deposits | Per-business Razorpay key/secret in **Connect** (untested against Razorpay) |
| Call Rescue | Telephony provider calling `/api/calls/missed` with `x-rescue-secret` |
| Plan switching | Demo only via `DEV_BILLING=1`; no subscription checkout |

## Not implemented
Google Calendar sync, subscription payments, Google/social login, prospect search ("Find clients"),
WhatsApp template management/delivery receipts, server-timezone-independent scheduling (hours use server local time).
