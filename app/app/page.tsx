import { redirect } from "next/navigation";
import WebLLMClient from "@/app/components/WebLLMClient";

export const dynamic = "force-dynamic";

export default async function AppRoute({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  // In Sprint 3, we simply gate by requiring *any* token parameter.
  // In Sprint 4, this will be replaced with Supabase Auth validation.
  if (!token) {
    redirect("/");
  }

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

        <WebLLMClient session_id={token} />
      </div>
    </main>
  );
}
