import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { promises as fs } from "fs";
import path from "path";
import { sendEmail } from "../_utils/email";

const DATA_PATH = path.join(process.cwd(), "data", "pto.json");
const HOURS_PER_DAY = 8 as const;

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
  type: any;
  id: string;
  userEmail: string;
  userName?: string | null;

  leaveType: LeaveType;
  durationType: DurationType;

  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (hourly: same as startDate)
  hours?: number; // only for hourly
  totalHours: number;

  reason: string;

  status: "pending" | "approved" | "denied";
  createdAt: string;
  updatedAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  deniedBy?: string | null;
  deniedAt?: string | null;
};

function isValidLeaveType(x: unknown): x is LeaveType {
  return (
    typeof x === "string" && (LEAVE_TYPES as readonly string[]).includes(x)
  );
}

function toDate(d: string) {
  return new Date(`${d}T00:00:00`);
}

function daysInclusive(start: string, end: string) {
  const s = toDate(start).getTime();
  const e = toDate(end).getTime();
  const diff = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  const aS = toDate(aStart).getTime();
  const aE = toDate(aEnd).getTime();
  const bS = toDate(bStart).getTime();
  const bE = toDate(bEnd).getTime();
  return aS <= bE && bS <= aE;
}

function normalizeRange(r: { startDate: string; endDate?: string | null }) {
  return {
    start: r.startDate,
    end: r.endDate && typeof r.endDate === "string" ? r.endDate : r.startDate,
  };
}

function randomId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ).toLowerCase();
}

async function readData(): Promise<{ requests: PTORequest[] }> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { requests: Array.isArray(parsed?.requests) ? parsed.requests : [] };
  } catch {
    return { requests: [] };
  }
}

async function writeData(data: { requests: PTORequest[] }) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

// GET /api/pto -> current user's requests
export async function GET() {
  const session = await getServerSession();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const data = await readData();
  const mine = data.requests.filter((r) => r.userEmail === email);

  return NextResponse.json({ requests: mine });
}

// POST /api/pto -> create a leave request
export async function POST(req: Request) {
  const session = await getServerSession();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  const leaveType = body?.leaveType as unknown;
  const durationType = body?.durationType as unknown;
  const startDate = body?.startDate as unknown;
  const endDate = body?.endDate as unknown;
  const reason = body?.reason as unknown;
  const hours = body?.hours as unknown;

  // All fields required (rules differ for hourly vs full-day)
  if (!isValidLeaveType(leaveType)) {
    return NextResponse.json({ error: "Invalid leave type" }, { status: 400 });
  }

  if (durationType !== "full_day" && durationType !== "hourly") {
    return NextResponse.json(
      { error: "Invalid duration type" },
      { status: 400 }
    );
  }

  if (typeof startDate !== "string" || startDate.trim().length === 0) {
    return NextResponse.json(
      { error: "Start date is required" },
      { status: 400 }
    );
  }

  if (typeof reason !== "string" || reason.trim().length === 0) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  let normalizedEndDate = startDate;
  let totalHours = 0;
  let hourlyHours: number | undefined = undefined;

  if (durationType === "hourly") {
    normalizedEndDate = startDate;

    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > HOURS_PER_DAY) {
      return NextResponse.json(
        { error: "Hours must be between 0.25 and 8" },
        { status: 400 }
      );
    }

    // enforce 0.25 increments
    const rounded = Math.round(h * 4) / 4;
    if (Math.abs(rounded - h) > 1e-9) {
      return NextResponse.json(
        { error: "Hours must be in 0.25 increments (e.g., 1.5, 2.25)" },
        { status: 400 }
      );
    }

    hourlyHours = h;
    totalHours = h;
  } else {
    if (typeof endDate !== "string" || endDate.trim().length === 0) {
      return NextResponse.json(
        { error: "End date is required for full-day leave" },
        { status: 400 }
      );
    }
    normalizedEndDate = endDate;

    const d = daysInclusive(startDate, normalizedEndDate);
    totalHours = d * HOURS_PER_DAY;
  }

  // Overlap prevention with existing pending/approved requests
  const data = await readData();
  const existing = data.requests.filter(
    (r) => r.userEmail === email && r.status !== "denied"
  );

  const newRange = { start: startDate, end: normalizedEndDate };
  const overlap = existing.some((r) => {
    const rr = normalizeRange(r);
    return rangesOverlap(newRange.start, newRange.end, rr.start, rr.end);
  });

  if (overlap) {
    return NextResponse.json(
      { error: "This request overlaps with an existing leave request." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  const newReq: PTORequest = {
    id: randomId(),
    userEmail: email,
    userName: session?.user?.name ?? null,

    leaveType,
    durationType,
    startDate,
    endDate: normalizedEndDate,
    hours: hourlyHours,
    totalHours,

    reason: reason.trim(),
    status: "pending",
    createdAt: now,
    updatedAt: now,

    approvedBy: null,
    approvedAt: null,
    deniedBy: null,
    deniedAt: null,
    type: undefined,
  };

  data.requests.push(newReq);
  await writeData(data);

  await sendEmail({
    to: (process.env.HR_EMAIL || "lkimbrough@bullzeyeequipment.com")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean),
    subject: `New PTO Request - ${newReq.userName || newReq.userEmail}`,
    html: `
      <h2>New PTO Request</h2>
      <p><strong>Employee:</strong> ${newReq.userName || "Unknown"}</p>
      <p><strong>Email:</strong> ${newReq.userEmail}</p>
      <p><strong>Leave Type:</strong> ${newReq.leaveType}</p>
      <p><strong>Start Date:</strong> ${newReq.startDate}</p>
      <p><strong>End Date:</strong> ${newReq.endDate}</p>
      <p><strong>Reason:</strong> ${newReq.reason}</p>
      <p><strong>Status:</strong> pending</p>
    `,
  });

  return NextResponse.json({ request: newReq }, { status: 201 });
}
