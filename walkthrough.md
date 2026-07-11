# payfirst-ai walkthrough

## What this app is
payfirst-ai is a validation site for a private, on-device document summarizer. The first version does not try to build the full AI feature yet. Instead, it proves demand by collecting a real payment and recording the purchase flow.

## Core experience
1. A visitor lands on the home page.
2. The landing page logs a visit and detects basic WebGPU capability.
3. The visitor enters an email and clicks Buy.
4. The app records a purchase intent and sends the visitor to Stripe Checkout.
5. After payment succeeds, Stripe sends a webhook to the app.
6. The webhook writes a completed purchase record to Supabase.
7. The visitor is redirected to the thank-you page, and the admin screen shows the new activity.

## Main pages
- Home page: the public landing experience and checkout entry point
- Thank-you page: confirmation screen shown after a successful payment
- Admin page: live counts for visits, intents, and purchases from the database

## Main backend flow
- Visit tracking: records a page visit and browser hardware signal
- Intent tracking: records that a user clicked the buy action
- Checkout: creates a hosted Stripe payment session
- Webhook: confirms payment and stores the purchase record

## Data the app tracks
- page_visits: anonymous visitor events
- purchase_intents: clicks on the buy call-to-action
- purchases: completed payments and buyer metadata
- feature_flags: admin-controlled toggles for experimental behavior

## How to run locally
- Install dependencies with bun install
- Start the app with bun dev
- Open the local app in a browser and test the full flow

## Expected end-to-end outcome
A real stranger should be able to land on the site, pay $29, arrive at the thank-you page, and have their purchase appear in Supabase and on the admin page.
