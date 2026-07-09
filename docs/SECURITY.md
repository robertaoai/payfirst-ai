# Security — payfirst-ai

## Secret Handling
- `STRIPE_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` live in Vercel environment variables only — never in client bundles or committed to git
- Payment webhook verified with provider signature before any DB write
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is anon-only; safe to expose

## Permission Model (v1 → lock-down)
- **v1:** open RLS policies on all tables (demo-first; no real buyer PII until payment goes live)
- **Lock-down sprint:** replace with `auth.uid() = user_id` owner-scoped policies; `/admin` requires authenticated admin role claim
- No user can read another user's purchase or activity rows after lock-down

## Approved Tools Rule
- API routes use only named Supabase client methods (`insert`, `select`, `update`) — no raw SQL execution from client
- No `eval`, no dynamic `run_any` — every DB action is a named function
- WebLLM runs 100% in the browser; document content never sent to any server or API

## Audit Principle
- Every payment webhook write is logged with provider ID for idempotency
- Every summarization event writes an `activities` row (action + duration + model name — zero document content)
- Before lock-down sprint: **stop and audit RLS policies manually** before allowing real buyer data to accumulate

## ⚠️ Stop Point
Do not accept real payments with PII (buyer email) until the webhook signature verification is confirmed working in production. If in doubt, use Stripe test mode and get a second pair of eyes on the webhook handler.
