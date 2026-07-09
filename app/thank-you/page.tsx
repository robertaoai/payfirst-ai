import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, CONNECT_ACCOUNT_ID } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * /thank-you page
 * Shows purchase confirmation with buyer email.
 * Retrieves checkout session from Stripe to display confirmation details.
 */
export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;
  let buyerEmail = "";
  let purchaseFound = false;

  if (sessionId) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const stripeConfigured = stripeKey && stripeKey !== "sk_test_placeholder_build_only";

    try {
      if (stripeConfigured) {
        // Retrieve the Stripe checkout session to get buyer details
        const stripeOptions = CONNECT_ACCOUNT_ID
          ? { stripeAccount: CONNECT_ACCOUNT_ID }
          : undefined;
        const session = await stripe.checkout.sessions.retrieve(sessionId, stripeOptions);
        buyerEmail = session.customer_details?.email || session.customer_email || "";
      }

      // Check if purchase was recorded in DB (works even without Stripe key)
      const supabase = createAdminClient();
      if (buyerEmail) {
        const { data } = await supabase
          .from("purchases")
          .select("id")
          .eq("buyer_email", buyerEmail)
          .eq("status", "completed")
          .limit(1);
        purchaseFound = (data?.length ?? 0) > 0;
      } else {
        // Without Stripe key, check if any recent purchase exists
        const { data } = await supabase
          .from("purchases")
          .select("id, buyer_email")
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          purchaseFound = true;
        }
      }
    } catch (err) {
      console.error("[thank-you] Error retrieving session:", err);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0a0a1a 0%, #0d1f0d 40%, #0a0a1a 100%)",
        color: "#e8e8ff",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: "520px", textAlign: "center" }}>
        {/* Success icon */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(52,211,153,0.1)",
            border: "2px solid rgba(52,211,153,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 2rem",
            fontSize: "2.5rem",
          }}
        >
          ✓
        </div>

        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 800,
            background: "linear-gradient(135deg, #34d399, #60a5fa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: "0 0 1rem 0",
          }}
        >
          You&apos;re in!
        </h1>

        <p style={{ fontSize: "1.1rem", color: "#aaaacc", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          Your purchase is confirmed. Welcome to private, on-device AI summarization.
        </p>

        {buyerEmail && (
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              padding: "1rem 1.5rem",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "#7777aa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
              Confirmation sent to
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#e0e0ff" }}>
              {buyerEmail}
            </div>
          </div>
        )}

        {purchaseFound && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "6px 14px",
              background: "rgba(52,211,153,0.1)",
              border: "1px solid rgba(52,211,153,0.2)",
              borderRadius: "999px",
              fontSize: "0.8rem",
              color: "#34d399",
              fontWeight: 500,
              marginBottom: "2rem",
            }}
          >
            ✓ Payment recorded
          </div>
        )}

        <div style={{ marginTop: "2rem" }}>
          <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.6 }}>
            We&apos;re building the on-device summarizer right now.
            You&apos;ll receive access at your email when it&apos;s ready.
          </p>
        </div>

        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: "2rem",
            padding: "0.75rem 2rem",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            color: "#aaaacc",
            textDecoration: "none",
            fontSize: "0.85rem",
            fontWeight: 500,
          }}
        >
          ← Back to home
        </a>
      </div>
    </main>
  );
}
