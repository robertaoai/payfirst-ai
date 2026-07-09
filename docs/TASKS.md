# Tasks — payfirst-ai

## Gantt Overview
```
Sprint 1: DB + seed + admin page            Days 1–2
Sprint 2: Landing page + payment (v1 ✅)    Days 2–4
Sprint 3: WebLLM feature wrapper            Days 5–9  (only after payment received)
Sprint 4: Lock it down                      Days 10–12
```

---

## Sprint 1 — DB, Seed Data, Admin Page
**Goal:** Live database with tables + seed rows; `/admin` page reads real counts.

- [ ] Run `migration_sql` against Supabase project
- [ ] Confirm 3 seed `purchases` rows visible in Supabase table viewer
- [ ] Build `/admin` route: fetch + display `page_visits` count, `purchase_intents` count, `purchases` count
- [ ] Confirm counts update when a new row is manually inserted via Supabase Studio
- [ ] No login required to view `/admin` (v1 open)

**Definition of Done:** `/admin` loads in browser, shows correct counts from live DB, updates within 5 seconds of a new row insert. No hardcoded numbers.

---

## Sprint 2 — Landing Page + Payment Link ✅ v1 functional milestone
**Goal:** Real stranger can pay; purchase row appears in DB.

- [ ] Write landing page copy: headline, pain paragraph, feature description, $29 price, single CTA
- [ ] Add WebGPU / VRAM detection widget (client-side JS, no server call)
- [ ] Wire CTA to Stripe Checkout or LemonSqueezy hosted page
- [ ] Implement `/api/webhooks/payment`: verify signature → insert `purchase` row
- [ ] Build `/thank-you` page: confirmation copy, buyer email displayed
- [ ] On page load: insert `page_visit` row (session_id, WebGPU flag, VRAM)
- [ ] On CTA click: insert `purchase_intent` row
- [ ] Deploy to Vercel production URL
- [ ] Send URL to 10+ target users (consultants / lawyers / researchers)

**Definition of Done:** At least one `purchases` row with `status='completed'` exists in the live DB from a real (non-seed) payment. `/admin` count increments. Webhook handler returns 200.

---

## Sprint 3 — WebLLM Summarizer (build only after Sprint 2 DoD is met)
**Goal:** Paying buyers can summarize documents 100% on-device.

- [ ] Scaffold `/app` route; gate with access_token from purchase redirect
- [ ] Integrate WebLLM: load `Llama-3.1-8B-Instruct-q4` via MLC AI CDN
- [ ] Model load progress bar (0–100%)
- [ ] File drop zone (PDF / TXT, parsed client-side)
- [ ] Summarize button → streams output into text panel
- [ ] Copy-to-clipboard button on output
- [ ] Five states: loading model / empty drop / file loaded / error (no WebGPU) / summary ready
- [ ] Fallback banner text: "Your GPU doesn't support on-device AI. Minimum: WebGPU-enabled browser + 6 GB VRAM recommended."
- [ ] On summarize_done: insert `activities` row (no document content — word count + duration only)
- [ ] Network tab check: zero outbound requests containing document text

**Definition of Done:** A buyer with a valid access_token can drop a PDF, click Summarize, and receive a summary with zero document data leaving the browser. Activities row exists in DB.

---

## Sprint 4 — Lock It Down
**Goal:** Real buyer data is owner-scoped; admin is authenticated.

- [ ] Enable Supabase Auth (magic link)
- [ ] Replace all v1 open RLS policies with `auth.uid() = user_id` policies
- [ ] On first buyer login: match `buyer_email` → set `user_id` on their `purchases` row
- [ ] Add admin role claim; gate `/admin` behind it
- [ ] Manual audit: attempt to read another user's purchase via Supabase client — confirm 0 rows returned
- [ ] Confirm webhook still inserts correctly under new policies (uses service role key)

**Definition of Done:** Logged-in buyer sees only their own purchase. Anonymous visitor sees zero purchase rows. Admin page requires login. Audit confirmed by manual test.
