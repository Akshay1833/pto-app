"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

const HOURS_PER_DAY = 8;

const LEAVE_TYPES = [
  "Vacation",
  "Personal leave",
  "Sick",
  "Jury duty",
  "Voting",
  "Bereavement",
  "Family medical leave",
  "Other",
] as const;

type LeaveType = (typeof LEAVE_TYPES)[number];
type DurationType = "full_day" | "hourly";

type PTORequest = {
  approvedBy: string;
  approvedAt: any;
  deniedBy: string;
  deniedAt: any;
  id: string;
  userEmail: string;
  userName?: string | null;

  leaveType: LeaveType;
  durationType: DurationType;

  startDate: string;
  endDate: string;
  hours?: number;
  totalHours: number;

  reason: string;

  status: "pending" | "approved" | "denied";
  createdAt: string;
  updatedAt: string;
};

type Balance = {
  ptoHours: number;
  sickHours: number;
};

function fmt(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function StatusPill({ status }: { status: PTORequest["status"] }) {
  const styles: Record<PTORequest["status"], React.CSSProperties> = {
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

function formatHoursAsDays(hours: number) {
  const days = hours / HOURS_PER_DAY;
  return days % 1 === 0 ? `${days} days` : `${days.toFixed(2)} days`;
}

export default function PTOPage() {
  const { data: session } = useSession();

  // form
  const [leaveType, setLeaveType] = useState<LeaveType>("Vacation");
  const [durationType, setDurationType] = useState<DurationType>("full_day");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hours, setHours] = useState("1"); // string for easier input
  const [reason, setReason] = useState("");

  // check if hr
  const [isHr, setIsHr] = useState(false);

  // data
  const [requests, setRequests] = useState<PTORequest[]>([]);
  const [balance, setBalance] = useState<Balance>({
    ptoHours: 0,
    sickHours: 0,
  });

  // ui state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBalance() {
    const res = await fetch("/api/balance", {
      cache: "no-store",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setBalance({
        ptoHours: Number(data.ptoHours ?? 0),
        sickHours: Number(data.sickHours ?? 0),
      });
    }
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
    let cancelled = false;

    async function initPage() {
      try {
        const hrRes = await fetch("/api/balance?all=1", { cache: "no-store" });

        if (!cancelled) {
          setIsHr(hrRes.ok);
        }
      } catch {
        if (!cancelled) {
          setIsHr(false);
        }
      }

      await loadRequests();
      await loadBalance();
    }

    initPage();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Required field enforcement (client-side; server also enforces)
      if (!leaveType) throw new Error("Leave type is required.");
      if (!durationType) throw new Error("Duration is required.");
      if (!startDate) throw new Error("Start date is required.");
      if (durationType === "full_day" && !endDate)
        throw new Error("End date is required.");
      if (!reason.trim()) throw new Error("Reason is required.");

      let payload: any = {
        leaveType,
        durationType,
        startDate,
        endDate: durationType === "hourly" ? startDate : endDate,
        reason: reason.trim(),
      };

      if (durationType === "hourly") {
        const h = Number(hours);
        if (!Number.isFinite(h) || h <= 0 || h > HOURS_PER_DAY) {
          throw new Error("Hours must be between 0.25 and 8.");
        }
        const rounded = Math.round(h * 4) / 4;
        if (Math.abs(rounded - h) > 1e-9) {
          throw new Error(
            "Hours must be in 0.25 increments (e.g., 1.5, 2.25)."
          );
        }
        payload.hours = h;
      }

      const res = await fetch("/api/pto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.error || "Failed to submit request.");
      }

      // reset form
      setStartDate("");
      setEndDate("");
      setReason("");
      setHours("1");
      setDurationType("full_day");
      setLeaveType("Vacation");

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
            <h1 style={{ fontSize: 28, margin: 0, letterSpacing: -0.3 }}>
              Bullzeye PTO
            </h1>

            {session?.user?.name && (
              <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
                Hello <strong>{session.user.name}</strong>
              </p>
            )}

            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                fontSize: 14,
              }}
            >
              <div
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                }}
              >
                PTO Remaining: <b>{balance.ptoHours}</b> hrs (
                {formatHoursAsDays(balance.ptoHours)})
              </div>
              <div
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                }}
              >
                Sick Remaining: <b>{balance.sickHours}</b> hrs (
                {formatHoursAsDays(balance.sickHours)})
              </div>
            </div>

            <p style={{ margin: "10px 0 0", color: "#6b7280" }}>
              Submit time off requests and track approval status.
            </p>
          </div>

          {isHr && (
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
          )}
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
          <h2 style={{ margin: 0, fontSize: 16 }}>New leave request</h2>
          <p style={{ margin: "6px 0 14px", color: "#6b7280", fontSize: 14 }}>
            All fields are required.
          </p>

          <form
            onSubmit={submitRequest}
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 13, color: "#374151" }}>
                Leave type
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                required
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
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 13, color: "#374151" }}>Duration</label>
              <select
                value={durationType}
                onChange={(e) =>
                  setDurationType(e.target.value as DurationType)
                }
                required
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
                <option value="full_day">Full day(s) (8 hrs/day)</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>

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

            {durationType === "full_day" ? (
              <div>
                <label style={{ fontSize: 13, color: "#374151" }}>
                  End date
                </label>
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
            ) : (
              <div>
                <label style={{ fontSize: 13, color: "#374151" }}>Hours</label>
                <input
                  type="number"
                  min={0.25}
                  max={8}
                  step={0.25}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
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
            )}

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 13, color: "#374151" }}>Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                placeholder="Required"
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
                <div style={{ fontWeight: 800, color: "#111827" }}>
                  {r.startDate} → {r.endDate}
                </div>
                <div style={{ marginTop: 6, color: "#374151" }}>
                  <b>{r.leaveType}</b> •{" "}
                  {r.durationType === "hourly"
                    ? `${r.hours} hrs`
                    : `${r.totalHours} hrs`}
                </div>
                <div style={{ marginTop: 6, color: "#374151" }}>{r.reason}</div>
              </div>
              <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>
                {r.status === "approved" && (
                  <span>
                    Approved by <b>{r.approvedBy || "HR"}</b>
                    {r.approvedAt ? ` • ${fmt(r.approvedAt)}` : ""}
                  </span>
                )}

                {r.status === "denied" && (
                  <span>
                    Denied by <b>{r.deniedBy || "HR"}</b>
                    {r.deniedAt ? ` • ${fmt(r.deniedAt)}` : ""}
                  </span>
                )}
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
