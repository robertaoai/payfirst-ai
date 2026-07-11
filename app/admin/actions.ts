"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function toggleFeatureFlag(featureName: string, isEnabled: boolean) {
  // createAdminClient automatically picks up SUPABASE_SERVICE_ROLE_KEY from .env.local
  const supabase = createAdminClient();
  
  const { error } = await supabase
    .from("feature_flags")
    .update({ is_enabled: isEnabled, updated_by: 'admin_server_action' })
    .eq("feature_name", featureName);

  if (error) {
    console.error("Server Action update error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/admin");
}
