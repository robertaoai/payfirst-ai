import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { session_id, word_count, duration_seconds } = body;

    const supabase = createAdminClient();
    
    // Insert activity row (anonymized usage metrics)
    const { error } = await supabase
      .from("activities")
      .insert([
        {
          session_id: session_id || "unknown",
          word_count: word_count || 0,
          duration_seconds: duration_seconds || 0,
        },
      ]);

    if (error) {
      console.error("[track/activity] DB Error:", error);
      return NextResponse.json({ error: "Failed to track activity" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[track/activity] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
