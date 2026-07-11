import { redirect } from "next/navigation";
import WebLLMClient from "@/app/components/WebLLMClient";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppRoute({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  let user;
  let purchases = [];

  if (process.env.NODE_ENV === "development") {
    user = {
      id: "mock-user-id",
      email: "robertanct@yahoo.com.sg",
      role: "authenticated",
    };
    purchases = [{ id: "mock-purchase-id", status: "completed" }];
  } else {
    const supabaseAuth = await createClient();
    const { data: { user: supabaseUser } } = await supabaseAuth.auth.getUser();
    user = supabaseUser;

    if (!user) {
      redirect("/login");
    }

    // Check if they actually paid (RLS ensures they only see their own purchases)
    const { data: dbPurchases } = await supabaseAuth
      .from("purchases")
      .select("id, status")
      .eq("status", "completed");
    purchases = dbPurchases || [];
  }

  if (!purchases || purchases.length === 0) {
    // If they logged in but haven't bought anything, redirect to landing page
    redirect("/");
  }

  // Use the user ID or email as the session identifier for tracking
  const sessionId = user.email || user.id;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#0a0a1a] text-neutral-200">
      <div className="max-w-4xl mx-auto p-4 md:p-8 pt-12">
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              payfirst-ai
            </h1>
            <p className="text-sm text-neutral-500 mt-1">Private Document Summarizer</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Access Granted
            </span>
          </div>
        </header>

        <WebLLMClient session_id={sessionId} />
      </div>
    </main>
  );
}
