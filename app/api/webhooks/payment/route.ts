import { stripe, CONNECT_ACCOUNT_ID } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import crypto from "crypto";

/**
 * POST /api/webhooks/payment
 *
 * Stripe webhook handler for payfirst-ai.
 * On checkout.session.completed → inserts a `purchases` row with
 * buyer_email, amount_cents, access_token, etc.
 *
 * Register this URL in Stripe dashboard: /api/webhooks/payment
 * Required event: checkout.session.completed
 */
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhooks/payment] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error("[webhooks/payment] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    // Acknowledge but ignore non-relevant events
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Only process completed payments
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  try {
    const supabase = createAdminClient();

    // Generate a unique access token for this buyer
    const accessToken = crypto.randomUUID();

    // Get buyer email from the session
    const buyerEmail = session.customer_details?.email || session.customer_email || "unknown";

    // Insert purchase (the DB's unique index on payment_provider_id will prevent duplicates)
    const { error } = await supabase.from("purchases").insert(
      {
        buyer_email: buyerEmail,
        amount_cents: session.amount_total ?? 2900,
        currency: session.currency ?? "usd",
        payment_provider: "stripe",
        payment_provider_id: session.payment_intent as string || session.id,
        status: "completed",
        access_token: accessToken,
      }
    );

    if (error) {
      console.error("[webhooks/payment] DB insert error:", error);
      // Still return 200 to prevent Stripe from retrying
    } else {
      console.log("[webhooks/payment] Purchase recorded for:", buyerEmail);
      
      // Proactively create an account / send invite so they can log in immediately
      try {
        await supabase.auth.admin.inviteUserByEmail(buyerEmail, {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/confirm`
        });
        console.log("[webhooks/payment] Sent invite to:", buyerEmail);
      } catch (inviteErr) {
        console.error("[webhooks/payment] Failed to send invite:", inviteErr);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhooks/payment] Handler error:", err);
    // Return 200 — Stripe retries on 5xx, and we don't want infinite retries
    return NextResponse.json({ received: true });
  }
}
