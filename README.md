# Devagent

[![CI](https://github.com/prapanjanprabhu/Devagent/actions/workflows/ci.yml/badge.svg)](https://github.com/prapanjanprabhu/Devagent/actions/workflows/ci.yml)
![Node 22](https://img.shields.io/badge/node-22-339933)
![Docker](https://img.shields.io/badge/docker-ready-2496ED)

Multi-tenant AI front desk for appointment/order businesses: WhatsApp + web booking, calendar, deposits,
reminders, waitlist, orders, enquiry pipeline, classes & packs, campaigns, grow agent, Call Rescue, analytics.
Design basis and evidence: [docs/ANALYSIS.md](docs/ANALYSIS.md).

## Run with Docker
```
cp .env.example .env
docker compose up -d --build                       # Postgres + app on http://localhost:3100
docker compose --profile monitoring up -d --build  # plus Prometheus :9090 and Grafana :3001
```
Health: `/api/health`, `/api/ready`, `/api/version`, `/api/metrics`, and a live `/status` page.
The pipeline (tests, build, Docker smoke test, publish to GHCR) and a demo script are in [docs/DEVOPS.md](docs/DEVOPS.md).

## Run without Docker for the app
The database is Postgres, so start one first (docker compose does it in one line).
```
npm install
docker compose up -d db          # Postgres on localhost:5440
copy .env.example .env.local     # then edit
npm run dev -- -p 3100           # or: npm run build && npm start -- -p 3100
npm test                         # needs the Postgres above
npm run typecheck
```
Needs Node >= 20.9. All data lives in Postgres (`DATABASE_URL`), so you can run several copies of the app against one database.
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
