# Analysis of welqo.io (basis for Devagent)

Method: REA `analyze_javascript_application` on the 204 downloaded Angular chunks
(evidence `ev_38241fe84a5035454758b6a773e3505e824f650d3a37ef0e86b32d69995ca329`, summary view
`ev_20a18db2…`), REA `capture_browser_scenario` on `/` and `/signup` (screenshots + network),
`robots.txt`, `sitemap.xml`, the shipped `assets/i18n/en.json`, `/about`, and public web search.
Date of capture: 2026-11-04. **Static/public observation only: no authenticated area, no backend code.**

## External sources
- No Wikipedia article exists for Welqo (searched). No independent reviews found.
- Google Play listing "Welqo: WhatsApp Booking AI" (developer ClipNova AI); company site `/about`
  names Clipnova AI (Mumbai) as operator. All feature claims are vendor-authored.

## Observed
| Area | Finding |
|---|---|
| Stack | Angular SPA (prerendered + hydrated), nginx/Ubuntu origin behind Cloudflare, PWA manifest, i18n JSON (20 locales), Google Identity + GA, Razorpay checkout script, Stencil web components (chat widget) |
| Landing `/` | Makes no backend API call; loads only `i18n/en.json` + `manifest.json` (network capture) |
| Public routes | `/signup`, `/login`, `/book/:tenantId`, `/m/:token` (customer's own booking, signed), `/call/:token`, `/w/:id` (WhatsApp hand-off redirect), `/widget.js`, ~120 SEO pages (verticals, "alternative to X", blog) in 10 locales |
| Merchant cockpit routes (robots.txt) | dashboard, conversations, agent-config, business-setup, analytics, calendar, customers, billing, connect-whatsapp, onboarding, support, account, admin, invite |
| Cockpit modules (i18n) | Overview, Chats, Customers, Campaigns, Analytics, Business setup, Agent setup, Grow, Find clients, Connect, Plans, Orders, Pipeline, Classes, Calendar |
| Business modules | Bookings & appointments · Orders & products · Leads & enquiries · Classes & fees (switched on per business type) |
| Services | duration, price (blank = quote case by case), deposit, **spots per slot** (1 = 1:1; 15 = class), active flag, packs |
| Calendar | add walk-in, move, block time, statuses Booked/Confirmed/Completed/Cancelled/No-show |
| Pipeline stages | New → Contacted → Qualified → Won / Lost, follow-up drafts |
| Campaigns | segments: all opted-in, lapsed 60d+, recent 30d, never booked, regulars 3+ visits; funnel sent/delivered/read/clicked; marketing templates need Meta approval |
| Grow agent | win-backs, Google review requests, prepaid-pack reminders, unpaid orders, open-slot offers (paid plans) |
| Call Rescue | dedicated number; missed call -> WhatsApp the caller -> AI books; $0.10/₹5 per rescued call |
| Setup | wizard: business type -> optional website URL -> AI drafts services/hours/products/answers from a one-sentence description ("never guesses prices") |
| Billing | Free (50 bookings/orders, 100 broadcasts), Booking $15/₹999, Front Desk $39/₹2,499; Razorpay/Stripe/Dodo checkout |
| Dashboard | "Recovered this week": rescued leads + waitlist slots; daily WhatsApp digest to owner |
| Compliance | official WhatsApp Business Platform; data deletion page; 0% commission, deposits settle to merchant's own Razorpay |

## Not observable (inferred or designed independently in Devagent)
Backend API shapes (only `/api/welqo/public/l/:id`, `/public/line/:id`, `/cockpit/activity?tenantId=`,
`/public/client-error` appear as literals; the rest are built dynamically), database schema, the AI
prompt/tooling, Meta template handling, Google Calendar OAuth, telephony provider, plan metering internals.
Devagent implements the *mechanisms* from the observed behavior; code, copy, name and visuals are original.

## Coverage limits
REA marks the JS graph partial (27k semantic unknowns, result-budget limits on 15 chunks); route/endpoint
extraction is therefore incomplete. The authenticated app was not exercised.
