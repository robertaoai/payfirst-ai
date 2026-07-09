import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid tokens" }, { status: 401 });
    }

    // Link purchases for this user
    if (data.user.email) {
      const adminSupabase = createAdminClient();
      await adminSupabase
        .from("purchases")
        .update({ user_id: data.user.id })
        .eq("buyer_email", data.user.email)
        .is("user_id", null);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
