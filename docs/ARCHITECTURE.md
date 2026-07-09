# Architecture — payfirst-ai

## Stack
- **Frontend:** Next.js 14 (App Router), deployed on Vercel
- **Database:** Supabase (Postgres + RLS)
- **Payments:** Stripe Checkout or Lemon Squeezy (hosted checkout, no card data in app)
- **On-device AI (later):** WebLLM (MLC AI), runs entirely in the browser via WebGPU

## Now vs Later
| Now (v1) | Later |
|---|---|
| Landing page + payment link | WebLLM summarizer feature |
| Purchase webhook → DB | Model download + progress UI |
| Hardware detection widget | File drop zone + output panel |
| `/admin` counts dashboard | Per-user auth + RLS lock-down |

## Key User Action Flow (payment)
1. Visitor lands on `/` → `page_visit` row inserted (session_id, WebGPU flag, VRAM)
2. Visitor clicks Buy → `purchase_intent` row inserted
3. Stripe/LemonSqueezy hosted checkout completes
4. Payment provider fires webhook → Next.js API route `/api/webhooks/payment` verifies signature
5. API route inserts `purchase` row (buyer_email, amount, provider_id, access_token)
6. Visitor redirected to `/thank-you?token=...`
7. `/admin` re-fetches counts from Supabase; new row visible immediately

## Layer Plan
1. **Data first** — tables + seed rows; admin page reads live DB
2. **App logic** — landing copy, CTA wiring, webhook handler, thank-you page
3. **Smart features** — WebLLM wrapper, model selector, on-device summarization (Sprint 3+)

## Core Without AI
The entire v1 (landing + payment capture + admin) runs with zero AI. The AI feature is a bolt-on added only after payment proof exists.
