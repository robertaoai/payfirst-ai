import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, CONNECT_ACCOUNT_ID } from "@/lib/stripe";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  const sessionId = searchParams.get("session_id");

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Security check: must provide session_id to bypass auth
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized: Missing session_id" }, { status: 401 });
  }

  try {
    // Verify the Stripe session is actually paid and belongs to the requested email
    const stripeOptions = CONNECT_ACCOUNT_ID ? { stripeAccount: CONNECT_ACCOUNT_ID } : undefined;
    const session = await stripe.checkout.sessions.retrieve(sessionId, stripeOptions);
    const sessionEmail = session.customer_details?.email || session.customer_email;

    if (session.payment_status !== "paid" || sessionEmail !== email) {
      return NextResponse.json({ error: "Unauthorized: Invalid or unpaid session" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // generateLink bypasses SMTP and rate limits!
    const { data, error } = await adminSupabase.auth.admin.generateLink({
      type: "magiclink",
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/confirm`
      }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data && data.properties && data.properties.action_link) {
      // Redirect directly to the generated magic link
      return NextResponse.redirect(data.properties.action_link);
    }

    return NextResponse.json({ error: "Failed to generate link" }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
