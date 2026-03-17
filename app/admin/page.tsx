"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function fmt(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

type PTORequest = {
  id: string;
  userEmail: string;
  userName?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  deniedBy?: string | null;
  deniedAt?: string | null;

  leaveType?:
    | "Vacation"
    | "Personal leave"
    | "Sick"
    | "Jury duty"
    | "Voting"
    | "Bereavement"
    | "Family medical leave"
    | "Other";

  durationType?: "full_day" | "hourly";
  startDate: string;
  endDate: string;
  hours?: number;
  totalHours?: number;

  reason: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  updatedAt: string;
};

type Balance = { ptoHours: number; sickHours: number };

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

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "pto" | "sick" | "neutral";
}) {
  const tones: Record<string, React.CSSProperties> = {
    neutral: {
      background: "#F3F4F6",
      border: "1px solid #E5E7EB",
      color: "#111827",
    },
    pto: {
      background: "#ECFDF5",
      border: "1px solid #A7F3D0",
      color: "#065F46",
    },
    sick: {
      background: "#EFF6FF",
      border: "1px solid #BFDBFE",
      color: "#1D4ED8",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        ...tones[tone],
      }}
    >
      {children}
    </span>
  );
}

export default function AdminPage() {
  const [requests, setRequests] = useState<PTORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, Balance>>({});

  const router = useRouter();
  const [hrChecked, setHrChecked] = useState(false);
  const [isHr, setIsHr] = useState(false);

  async function loadBalances() {
    try {
      const res = await fetch("/api/balance?all=1", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.balances) {
        setBalances(data.balances);
      } else {
        setBalances({});
      }
    } catch {
      setBalances({});
    }
  }

  async function loadRequests() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.error || "Failed to load admin requests.");

      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (e: any) {
      setRequests([]);
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

      // refresh both lists + balances after action
      await loadRequests();
      await loadBalances();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setWorkingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function checkHrAccess() {
      try {
        const res = await fetch("/api/balance?all=1", { cache: "no-store" });

        if (cancelled) return;

        if (res.status === 401 || res.status === 403) {
          router.replace("/pto");
          return;
        }

        if (!res.ok) {
          router.replace("/pto");
          return;
        }

        setIsHr(true);
        setHrChecked(true);
      } catch {
        router.replace("/pto");
      }
    }

    checkHrAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!hrChecked || !isHr) return;

    loadRequests();
    loadBalances();
  }, [hrChecked, isHr]);

  const sorted = useMemo(() => {
    return [...requests].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || "")
    );
  }, [requests]);

  const grouped = useMemo(() => {
    const map: Record<string, PTORequest[]> = {};
    for (const r of sorted) {
      const key = (r.userEmail || "unknown").toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [sorted]);

  const employeeKeys = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  useEffect(() => {
    // auto-select first employee
    if (!selectedEmail && employeeKeys.length > 0) {
      setSelectedEmail(employeeKeys[0]);
    }
  }, [employeeKeys, selectedEmail]);

  const selectedItems = useMemo(() => {
    if (!selectedEmail) return [];
    return grouped[selectedEmail] || [];
  }, [grouped, selectedEmail]);

  const selectedName = useMemo(() => {
    const first = selectedItems[0];
    return first?.userName || selectedEmail || "";
  }, [selectedItems, selectedEmail]);

  const selectedBal = useMemo(() => {
    if (!selectedEmail) return null;
    return balances[selectedEmail] || null;
  }, [balances, selectedEmail]);

  // quick responsive helper
  const isMobile =
    typeof window !== "undefined" ? window.innerWidth < 900 : false;

  if (!hrChecked) {
    return <div style={{ padding: 24 }}>Checking access...</div>;
  }
  return (
    <div style={{ background: "#ffffff", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 18px" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, margin: 0, letterSpacing: -0.3 }}>
              HR PTO Dashboards
            </h1>
            <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
              Review and approve employee leave requests.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => {
                loadRequests();
                loadBalances();
              }}
              style={{
                border: "1px solid #e5e7eb",
                background: "#fafafa",
                padding: "10px 14px",
                borderRadius: 12,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Refresh
            </button>

            <a
              href="/pto"
              style={{
                fontSize: 14,
                textDecoration: "none",
                color: "#111827",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "10px 14px",
                background: "#ffffff",
                fontWeight: 700,
              }}
            >
              ← Employee view
            </a>
          </div>
        </header>

        <div style={{ height: 16 }} />

        {error && (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              padding: "12px 14px",
              borderRadius: 14,
              marginBottom: 14,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/* Main layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "340px 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* LEFT: Employees card (ONLY ONCE) */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              background: "#ffffff",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: 900 }}>Employees</div>
              <div style={{ color: "#6b7280", fontSize: 13 }}>
                {employeeKeys.length} total
              </div>
            </div>

            <div
              style={{ maxHeight: isMobile ? "unset" : 520, overflow: "auto" }}
            >
              {loading && employeeKeys.length === 0 ? (
                <div style={{ padding: 14, color: "#6b7280" }}>Loading…</div>
              ) : employeeKeys.length === 0 ? (
                <div style={{ padding: 14, color: "#6b7280" }}>
                  No requests yet.
                </div>
              ) : (
                employeeKeys.map((email) => {
                  const items = grouped[email] || [];
                  const name = items[0]?.userName || email;
                  const bal = balances[email];
                  const active = selectedEmail === email;

                  const pendingCount = items.filter(
                    (r) => r.status === "pending"
                  ).length;

                  return (
                    <button
                      key={email}
                      onClick={() => setSelectedEmail(email)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        background: active ? "#f9fafb" : "#ffffff",
                        padding: 14,
                        cursor: "pointer",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900, color: "#111827" }}>
                            {name}
                          </div>
                          <div style={{ color: "#6b7280", fontSize: 13 }}>
                            {email}
                          </div>
                        </div>

                        {pendingCount > 0 && (
                          <span
                            style={{
                              height: 26,
                              padding: "0 10px",
                              borderRadius: 999,
                              display: "inline-flex",
                              alignItems: "center",
                              border: "1px solid #fed7aa",
                              background: "#fff7ed",
                              color: "#9a3412",
                              fontWeight: 800,
                              fontSize: 12,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {pendingCount} pending
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          fontSize: 13,
                        }}
                      >
                        <Badge tone="pto">
                          PTO {bal ? bal.ptoHours : "—"}h
                        </Badge>
                        <Badge tone="sick">
                          Sick {bal ? bal.sickHours : "—"}h
                        </Badge>
                        <Badge>{items.length} req</Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Details card */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              background: "#ffffff",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            {!selectedEmail ? (
              <div style={{ padding: 16, color: "#6b7280" }}>
                Select an employee.
              </div>
            ) : (
              <>
                {/* Detail header */}
                <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {selectedName}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {selectedEmail}
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      fontSize: 13,
                    }}
                  >
                    <Badge tone="pto">
                      Remaining PTO:{" "}
                      <b>{selectedBal ? selectedBal.ptoHours : "—"}</b> hrs
                    </Badge>
                    <Badge tone="sick">
                      Remaining Sick:{" "}
                      <b>{selectedBal ? selectedBal.sickHours : "—"}</b> hrs
                    </Badge>
                  </div>
                </div>

                {/* Requests list */}
                <div style={{ padding: 16 }}>
                  {loading ? (
                    <div style={{ color: "#6b7280" }}>Loading…</div>
                  ) : selectedItems.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>
                      No requests for this employee.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {selectedItems.map((r) => {
                        const isPending = r.status === "pending";
                        const showHours =
                          r.durationType === "hourly"
                            ? r.hours ?? r.totalHours ?? ""
                            : r.totalHours ?? "";

                        return (
                          <div
                            key={r.id}
                            style={{
                              border: "1px solid #f3f4f6",
                              borderRadius: 14,
                              padding: 14,
                              display: "grid",
                              gridTemplateColumns: isMobile
                                ? "1fr"
                                : "1fr auto",
                              gap: 12,
                              alignItems: "start",
                            }}
                          >
                            <div>
                              <div
                                style={{ fontWeight: 900, color: "#111827" }}
                              >
                                {r.startDate} → {r.endDate}
                              </div>

                              <div
                                style={{
                                  marginTop: 6,
                                  color: "#374151",
                                  fontSize: 13,
                                }}
                              >
                                Type: <b>{r.leaveType || "—"}</b> • Duration:{" "}
                                <b>{r.durationType || "—"}</b> • Hours:{" "}
                                <b>{showHours || "—"}</b>
                              </div>

                              <div style={{ marginTop: 8, color: "#374151" }}>
                                {r.reason}
                              </div>

                              <div style={{ marginTop: 10 }}>
                                <StatusPill status={r.status} />
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                justifyContent: isMobile
                                  ? "flex-start"
                                  : "flex-end",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                onClick={() => act(r.id, "approve")}
                                disabled={!isPending || workingId === r.id}
                                style={{
                                  border: "1px solid #065f46",
                                  background: isPending ? "#ecfdf5" : "#f3f4f6",
                                  color: isPending ? "#065f46" : "#9ca3af",
                                  padding: "10px 14px",
                                  borderRadius: 12,
                                  cursor: isPending ? "pointer" : "not-allowed",
                                  fontWeight: 800,
                                  minWidth: 96,
                                }}
                              >
                                {workingId === r.id ? "…" : "Approve"}
                              </button>

                              <button
                                onClick={() => act(r.id, "deny")}
                                disabled={!isPending || workingId === r.id}
                                style={{
                                  border: "1px solid #991b1b",
                                  background: isPending ? "#fef2f2" : "#f3f4f6",
                                  color: isPending ? "#991b1b" : "#9ca3af",
                                  padding: "10px 14px",
                                  borderRadius: 12,
                                  cursor: isPending ? "pointer" : "not-allowed",
                                  fontWeight: 800,
                                  minWidth: 96,
                                }}
                              >
                                {workingId === r.id ? "…" : "Deny"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <footer style={{ marginTop: 18, color: "#9ca3af", fontSize: 12 }}>
          HR-only • Bullzeye Equipment
        </footer>
      </div>
    </div>
  );
}
