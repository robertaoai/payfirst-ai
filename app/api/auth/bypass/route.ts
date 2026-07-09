import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
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
