import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/**
 * POST /api/track/intent
 * Inserts a purchase_intent row. Called when user clicks the Buy CTA.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_id, price_cents, cta_label } = body;

    if (!session_id) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("purchase_intents").insert({
      session_id,
      price_cents: price_cents ?? 2900,
      cta_label: cta_label || "Buy",
    });

    if (error) {
      console.error("[track/intent]", error);
      return NextResponse.json({ error: "Failed to log intent" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[track/intent]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
