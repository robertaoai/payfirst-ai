import { stripe, CONNECT_ACCOUNT_ID, PLATFORM_FEE_PERCENT } from "@/lib/stripe";
import { NextResponse } from "next/server";

/**
 * POST /api/checkout
 * Creates a Stripe Checkout Session for the $29 one-time payment.
 * No auth required — this is a public checkout flow.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_id } = body;
    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Build params for one-time $29 payment
    const params: any = {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "payfirst-ai — Private Document Summarizer",
              description: "Lifetime access to on-device AI summarization. Your documents never leave your laptop.",
            },
            unit_amount: 2900, // $29.00
          },
          quantity: 1,
        },
      ],
      customer_creation: "always",
      success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}`,
      metadata: {
        session_id: session_id || "unknown",
      },
    };

    // If running through Stripe Connect platform, add application_fee_amount
    if (CONNECT_ACCOUNT_ID && PLATFORM_FEE_PERCENT > 0) {
      params.payment_intent_data = {
        application_fee_amount: Math.round(2900 * (PLATFORM_FEE_PERCENT / 100)),
      };
    }

    const stripeOptions = CONNECT_ACCOUNT_ID
      ? { stripeAccount: CONNECT_ACCOUNT_ID }
      : undefined;

    const checkoutSession = await stripe.checkout.sessions.create(params, stripeOptions);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
