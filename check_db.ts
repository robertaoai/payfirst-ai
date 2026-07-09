import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("buyer_email", "robertanct@yahoo.com.sg");
  console.log("Purchases:", data);
  console.log("Error:", error);

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  console.log("Users:", authData.users?.filter(u => u.email === "robertanct@yahoo.com.sg"));
  console.log("Auth Error:", authError);
}

check();
