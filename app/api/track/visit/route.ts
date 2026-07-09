import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/**
 * POST /api/track/visit
 * Inserts a page_visit row. Called from landing page on load.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_id, referrer, webgpu_available, vram_gb } = body;

    if (!session_id) {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("page_visits").insert({
      session_id,
      referrer: referrer || null,
      webgpu_available: webgpu_available ?? false,
      vram_gb: vram_gb ?? 0,
    });

    if (error) {
      console.error("[track/visit]", error);
      return NextResponse.json({ error: "Failed to log visit" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[track/visit]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
