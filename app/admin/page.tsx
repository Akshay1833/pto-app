"use client";

import { useEffect, useMemo, useState } from "react";

type PTORequest = {
  id: string;
  userEmail: string;
  userName?: string | null;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  updatedAt: string;
};

function StatusPill({ status }: { status: PTORequest["status"] }) {
  const styles: Record<string, React.CSSProperties> = {
    pending: {
      background: "#FFF7ED",
      color: "#9A3412",
      border: "1px solid #FED7AA",
    },
    approved: {
      background: "#ECFDF5",
      color: "#065F46",
      border: "1px solid #A7F3D0",
    },
    denied: {
      background: "#FEF2F2",
      color: "#991B1B",
      border: "1px solid #FECACA",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        textTransform: "capitalize",
        ...styles[status],
      }}
    >
      {status}
    </span>
  );
}

export default function AdminPage() {
  const [requests, setRequests] = useState<PTORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRequests() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin");
      const data = await res.json();
      if (!res.ok)
        throw new Error(data?.error || "Failed to load admin requests.");
      setRequests(data.requests ?? []);
    } catch (e: any) {
      setError(e?.message || "Could not load requests.");
    } finally {
      setLoading(false);
    }
  }

  async function act(id: string, action: "approve" | "deny") {
    setWorkingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed to ${action}.`);
      await loadRequests();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setWorkingId(null);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  const sorted = useMemo(() => {
    return [...requests].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );
  }, [requests]);

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, margin: 0, letterSpacing: -0.3 }}>
              HR PTO Dashboard
            </h1>
            <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
              Review and approve employee PTO requests.
            </p>
          </div>

          <a
            href="/pto"
            style={{
              fontSize: 14,
              textDecoration: "none",
              color: "#111827",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "10px 12px",
              background: "#fafafa",
            }}
          >
            ← Employee view
          </a>
        </header>

        <div style={{ height: 18 }} />

        {error && (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              padding: "10px 12px",
              borderRadius: 12,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#ffffff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 16 }}>All requests</h2>
              <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
                {loading ? "Loading..." : `${sorted.length} total`}
              </p>
            </div>
            <button
              onClick={loadRequests}
              style={{
                border: "1px solid #e5e7eb",
                background: "#fafafa",
                padding: "10px 12px",
                borderRadius: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Refresh
            </button>
          </div>

          {!loading && sorted.length === 0 && (
            <div style={{ padding: 16, color: "#6b7280" }}>
              No requests yet.
            </div>
          )}

          {sorted.map((r) => (
            <div
              key={r.id}
              style={{
                padding: 16,
                borderTop: "1px solid #f3f4f6",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#111827" }}>
                    {r.userName || r.userEmail}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {r.userEmail}
                  </div>
                </div>

                <div style={{ marginTop: 8, fontWeight: 700 }}>
                  {r.startDate} → {r.endDate}
                </div>

                <div style={{ marginTop: 6, color: "#374151" }}>{r.reason}</div>

                <div style={{ marginTop: 10 }}>
                  <StatusPill status={r.status} />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => act(r.id, "approve")}
                  disabled={r.status !== "pending" || workingId === r.id}
                  style={{
                    border: "1px solid #065f46",
                    background: r.status !== "pending" ? "#f3f4f6" : "#ecfdf5",
                    color: r.status !== "pending" ? "#9ca3af" : "#065f46",
                    padding: "10px 12px",
                    borderRadius: 12,
                    cursor: r.status !== "pending" ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {workingId === r.id ? "..." : "Approve"}
                </button>

                <button
                  onClick={() => act(r.id, "deny")}
                  disabled={r.status !== "pending" || workingId === r.id}
                  style={{
                    border: "1px solid #991b1b",
                    background: r.status !== "pending" ? "#f3f4f6" : "#fef2f2",
                    color: r.status !== "pending" ? "#9ca3af" : "#991b1b",
                    padding: "10px 12px",
                    borderRadius: 12,
                    cursor: r.status !== "pending" ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {workingId === r.id ? "..." : "Deny"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <footer style={{ marginTop: 18, color: "#9ca3af", fontSize: 12 }}>
          HR-only • Bullzeye Equipment
        </footer>
      </div>
    </div>
  );
}
