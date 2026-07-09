import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function test() {
  console.log("Checking if payment exists...");
  const { data: existing } = await supabase
    .from("purchases")
    .select("*")
    .eq("payment_provider_id", "pi_3TrJZhBmfYQRf2cl1Q3ybWZK");
  
  console.log("Existing:", existing);

  console.log("\nAttempting to insert...");
  const { data, error } = await supabase.from("purchases").insert(
    {
      buyer_email: "robertitwooogle@gmail.com",
      amount_cents: 2900,
      currency: "usd",
      payment_provider: "stripe",
      payment_provider_id: "pi_3TrJZhBmfYQRf2cl1Q3ybWZK",
      status: "completed",
      access_token: "test-access-token",
    }
  );

  console.log("Insert Error:", error);
  console.log("Insert Data:", data);
}

test();
