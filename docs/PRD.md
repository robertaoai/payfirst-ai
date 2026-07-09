# PRD — payfirst-ai

## Problem
Consultants, lawyers, and researchers handle sensitive documents they cannot legally or ethically upload to cloud AI services (ChatGPT, Claude, etc.). They have no trustworthy private option today.

## Target User
A solo professional (consultant, lawyer, researcher) who regularly summarizes long confidential documents on a laptop and would pay to do it privately.

## Core Objects
| Object | What it is |
|---|---|
| `page_visit` | Anonymous visit event with hardware signal (WebGPU, VRAM) |
| `purchase_intent` | CTA click before checkout |
| `purchase` | Confirmed payment from a real stranger |
| `activity` | On-device summarization event log (no content, just metadata) |

## MVP — v1 Must-Haves
- [ ] One-page landing with single sharp headline, one price ($29), one payment link
- [ ] WebGPU / VRAM detection widget visible on landing (builds credibility, no data sent)
- [ ] Payment webhook writes `purchase` row to Supabase on success
- [ ] `/thank-you` page with confirmation copy and buyer email captured
- [ ] `/admin` page (no login) shows live visit / intent / purchase counts from DB
- [ ] All counts reflect real DB rows (not hardcoded)

## Non-Goals (v1)
- WebLLM feature wrapper (build only after first real payment)
- User accounts / login
- Document Q&A, history, or any second feature
- Mobile-first design, PWA, offline mode

## Success Criteria
**One concrete end-to-end scenario:**
A stranger lands on the page, sees the price, clicks Buy, pays $29 via Stripe/Lemon Squeezy, lands on `/thank-you`, and a `purchase` row appears in Supabase. The `/admin` page shows purchase count = 1 (or more). That is the v1 done signal.
