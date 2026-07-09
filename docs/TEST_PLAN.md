# Test Plan — payfirst-ai

## v1 Success Scenario (end-to-end)

### Setup
- Vercel production URL live
- Stripe test mode active; use card `4242 4242 4242 4242`
- Supabase Studio open in second tab

### Steps
1. Open landing page in fresh incognito window
2. **Check:** page loads; headline and price ($29) visible; WebGPU widget renders (either "supported" or "not supported" — no blank/error)
3. **Check Supabase:** one new `page_visits` row created with correct `session_id`
4. Click the Buy button
5. **Check Supabase:** one new `purchase_intents` row created
6. Complete Stripe test checkout with test card
7. **Check:** redirected to `/thank-you`; confirmation copy visible; buyer email displayed
8. **Check Supabase:** one new `purchases` row with `status='completed'` and non-null `access_token`
9. Open `/admin`; **Check:** purchase count = seed count + 1

**Pass:** all 9 checks green. **Fail:** any step shows no DB row, wrong count, or error page.

---

## Empty / Error States

| Scenario | Expected Behaviour |
|---|---|
| `/admin` loaded before any real purchases | Shows seed count (3); clearly labelled as demo rows |
| WebGPU not available on visitor's machine | Widget shows "Not supported" badge; does not crash or blank |
| Stripe webhook arrives with invalid signature | API returns 400; no DB row inserted; error logged |
| Webhook fires twice (duplicate provider_id) | Second insert ignored (upsert on `payment_provider_id`) or returns 200 without duplicate row |
| Buyer visits `/app` with invalid token | Shown "Invalid or expired access link" message; no summarizer UI rendered |
| Model load fails (WebGPU unavailable in /app) | Fallback banner displayed; summarize button disabled |

## Regression After Lock-Down Sprint
- Confirm anonymous client `select * from purchases` returns 0 rows
- Confirm buyer A cannot read buyer B's purchase row
- Confirm webhook (service role) can still insert purchase rows
