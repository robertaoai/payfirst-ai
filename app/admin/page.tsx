import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getCounts() {
  const supabase = createAdminClient();

  const [visitsRes, intentsRes, purchasesRes] = await Promise.all([
    supabase
      .from("page_visits")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("purchase_intents")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("purchases")
      .select("*", { count: "exact", head: true }),
  ]);

  return {
    visits: visitsRes.count ?? 0,
    intents: intentsRes.count ?? 0,
    purchases: purchasesRes.count ?? 0,
  };
}

async function getRecentPurchases() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("purchases")
    .select("id, buyer_email, amount_cents, currency, payment_provider, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  return data ?? [];
}

export default async function AdminPage() {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  // Gate the page behind auth and a simulated admin role check.
  // In a real app, ensure you set custom claims for roles.
  // For safety in this demo, if they aren't logged in, they can't view it.
  if (!user || user.app_metadata?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a] text-red-400">
        <h1>401 - Unauthorized</h1>
        <p className="text-sm mt-2 text-neutral-400">Admin role required.</p>
      </div>
    );
  }

  const counts = await getCounts();
  const recentPurchases = await getRecentPurchases();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)",
        color: "#e0e0ff",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              background: "linear-gradient(90deg, #a78bfa, #60a5fa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              margin: 0,
            }}
          >
            payfirst-ai — Admin
          </h1>
          <p style={{ color: "#8888aa", marginTop: "0.5rem", fontSize: "0.875rem" }}>
            Live metrics from Supabase · Auto-refreshes on page load
          </p>
        </div>

        {/* Stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1.25rem",
            marginBottom: "2.5rem",
          }}
        >
          <StatCard label="Page Visits" value={counts.visits} icon="👁" color="#60a5fa" />
          <StatCard label="Purchase Intents" value={counts.intents} icon="🎯" color="#f59e0b" />
          <StatCard label="Purchases" value={counts.purchases} icon="💰" color="#34d399" />
        </div>

        {/* Conversion funnel */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "1.5rem",
            marginBottom: "2.5rem",
          }}
        >
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 1rem 0", color: "#c4b5fd" }}>
            Conversion Funnel
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <FunnelStep label="Visits" value={counts.visits} />
            <span style={{ color: "#555", fontSize: "1.25rem" }}>→</span>
            <FunnelStep label="Intents" value={counts.intents} />
            <span style={{ color: "#555", fontSize: "1.25rem" }}>→</span>
            <FunnelStep label="Purchases" value={counts.purchases} />
            <span style={{ color: "#666", fontSize: "0.8rem", marginLeft: "auto" }}>
              Intent rate: {counts.visits > 0 ? ((counts.intents / counts.visits) * 100).toFixed(1) : "0.0"}%
              {" · "}
              Purchase rate: {counts.intents > 0 ? ((counts.purchases / counts.intents) * 100).toFixed(1) : "0.0"}%
            </span>
          </div>
        </div>

        {/* Recent purchases table */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "1.5rem",
          }}
        >
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 1rem 0", color: "#c4b5fd" }}>
            Recent Purchases
          </h2>
          {recentPurchases.length === 0 ? (
            <p style={{ color: "#666", fontStyle: "italic" }}>No purchases yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.85rem",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Provider</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPurchases.map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={tdStyle}>{p.buyer_email}</td>
                      <td style={tdStyle}>
                        ${(p.amount_cents / 100).toFixed(2)} {p.currency?.toUpperCase()}
                      </td>
                      <td style={tdStyle}>{p.payment_provider}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: p.status === "completed" ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.15)",
                            color: p.status === "completed" ? "#34d399" : "#ef4444",
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {new Date(p.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ── Sub-components ────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: `linear-gradient(90deg, ${color}, transparent)`,
        }}
      />
      <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{icon}</div>
      <div style={{ fontSize: "2rem", fontWeight: 700, color, lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: "0.8rem", color: "#8888aa", marginTop: "0.25rem" }}>
        {label}
      </div>
    </div>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#e0e0ff" }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: "0.7rem", color: "#8888aa" }}>{label}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.6rem 0.75rem",
  color: "#8888aa",
  fontWeight: 500,
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "0.6rem 0.75rem",
  color: "#c8c8e0",
};
