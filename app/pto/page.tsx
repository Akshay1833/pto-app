"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

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

export default function PTOPage() {
  const [requests, setRequests] = useState<PTORequest[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState("not-started");
  const { data: session } = useSession();
  const [balance, setBalance] = useState({ pto: 0, sick: 0 });
  const [reqType, setReqType] = useState<"pto" | "sick">("pto");

  async function loadBalance() {
    const res = await fetch("/api/balance");
    const data = await res.json();
    setBalance(data);
  }

  async function loadRequests() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/pto", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error || `Failed to load requests (${res.status})`
        );
      }

      setRequests(data.requests ?? []);
    } catch (e: any) {
      setError(e?.message || "Could not load requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setDebug("useEffect-fired");
    loadRequests();
    loadBalance();
    loadRequests()
      .then(() => setDebug("loadRequests-finished"))
      .catch(() => setDebug("loadRequests-error"));
  }, []);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/pto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate, reason, type: reqType }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to submit request.");
      }

      setStartDate("");
      setEndDate("");
      setReason("");
      await loadRequests();
      await loadBalance();
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const sorted = useMemo(() => {
    return [...requests].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );
  }, [requests]);

  return (
    <div style={{ background: "#ffffff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-end",
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, margin: 0 }}>Bullzeye PTO</h1>

            {session?.user?.name && (
              <p style={{ marginTop: 6, color: "#6b7280" }}>
                Hello <strong>{session.user.name}</strong>
              </p>
            )}

            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 16,
                fontSize: 14,
              }}
            >
              <div
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                }}
              >
                PTO Remaining: <b>{balance.pto}</b>
              </div>

              <div
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                }}
              >
                Sick Days: <b>{balance.sick}</b>
              </div>
            </div>

            <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
              Submit time off requests and track approval status.
            </p>
          </div>

          <a
            href="/admin"
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
            HR Dashboard →
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
            padding: 18,
            background: "#ffffff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>New PTO request</h2>
          <p style={{ margin: "6px 0 14px", color: "#6b7280", fontSize: 14 }}>
            Fill out the details below. HR will review and approve/deny.
          </p>

          <form
            onSubmit={submitRequest}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label style={{ fontSize: 13, color: "#374151" }}>
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, color: "#374151" }}>End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 13, color: "#374151" }}>
                  Request type
                </label>
                <select
                  value={reqType}
                  onChange={(e) => setReqType(e.target.value as "pto" | "sick")}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    outline: "none",
                    background: "#fff",
                  }}
                >
                  <option value="pto">PTO</option>
                  <option value="sick">Sick</option>
                </select>
              </div>
              <label style={{ fontSize: 13, color: "#374151" }}>Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                placeholder="Vacation, appointment, sick day, etc."
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="submit"
                disabled={submitting}
                style={{
                  border: "1px solid #111827",
                  background: submitting ? "#111827cc" : "#111827",
                  color: "white",
                  padding: "10px 14px",
                  borderRadius: 12,
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {submitting ? "Submitting..." : "Submit request"}
              </button>
            </div>
          </form>
        </div>

        <div style={{ height: 16 }} />

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
              <h2 style={{ margin: 0, fontSize: 16 }}>Your requests</h2>
              <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
                {loading
                  ? "Loading..."
                  : `${sorted.length} request${sorted.length === 1 ? "" : "s"}`}
              </p>
            </div>
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
                <div style={{ fontWeight: 700, color: "#111827" }}>
                  {r.startDate} → {r.endDate}
                </div>
                <div style={{ marginTop: 6, color: "#374151" }}>{r.reason}</div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                }}
              >
                <StatusPill status={r.status} />
              </div>
            </div>
          ))}
        </div>

        <footer style={{ marginTop: 18, color: "#9ca3af", fontSize: 12 }}>
          Bullzeye Equipment • Internal PTO tool
        </footer>
      </div>
    </div>
  );
}
