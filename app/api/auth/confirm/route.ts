import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/app";

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error && data.user) {
      const email = data.user.email;
      
      // On first login, link existing purchases to this user
      // Need admin client to bypass RLS for updating another row's user_id if it's currently null
      if (email) {
        const adminSupabase = createAdminClient();
        await adminSupabase
          .from("purchases")
          .update({ user_id: data.user.id })
          .eq("buyer_email", email)
          .is("user_id", null);
      }

      // Redirect back to app
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=Invalid_Token", request.url));
}
