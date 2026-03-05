import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { promises as fs } from "fs";
import path from "path";
import { requireHr } from "../../_utils/isHr";

const DATA_PATH = path.join(process.cwd(), "data", "pto.json");
const BALANCE_PATH = path.join(process.cwd(), "data", "balances.json");

// Which leave types should deduct from which bucket
const LEAVE_DEDUCT_RULES: Record<string, "pto" | "sick" | "none"> = {
  Vacation: "pto",
  "Personal leave": "pto",
  Sick: "sick",
  "Jury duty": "none",
  Voting: "none",
  Bereavement: "none",
  "Family medical leave": "none",
  Other: "pto",
};

type BalanceMap = Record<string, { ptoHours: number; sickHours: number }>;

type PTORequest = {
  id: string;
  userEmail: string;
  userName?: string | null;

  leaveType?: string;
  durationType?: "full_day" | "hourly";
  startDate?: string;
  endDate?: string;
  hours?: number;
  totalHours?: number;

  reason?: string;

  status: "pending" | "approved" | "denied";
  createdAt?: string;
  updatedAt?: string;

  approvedBy?: string | null;
  approvedAt?: string | null;
  deniedBy?: string | null;
  deniedAt?: string | null;
};

async function readData(): Promise<{ requests: PTORequest[] }> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      requests: Array.isArray(parsed?.requests) ? parsed.requests : [],
    };
  } catch {
    return { requests: [] };
  }
}

async function writeData(data: { requests: PTORequest[] }) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function readBalances(): Promise<BalanceMap> {
  try {
    const raw = await fs.readFile(BALANCE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeBalances(balances: BalanceMap) {
  await fs.mkdir(path.dirname(BALANCE_PATH), { recursive: true });
  await fs.writeFile(BALANCE_PATH, JSON.stringify(balances, null, 2), "utf8");
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const hrEmail = session?.user?.email?.toLowerCase();

  if (!hrEmail) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // HR-only gate
  const hr = await requireHr();
  if (!hr?.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const data = await readData();
  const item = data.requests.find((r) => r.id === id);

  if (!item) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Only pending can be approved (prevents double-deduct)
  if (item.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending requests can be approved." },
      { status: 400 }
    );
  }

  const leaveType = item.leaveType || "Other";
  const bucket: "pto" | "sick" | "none" =
    LEAVE_DEDUCT_RULES[leaveType] ?? "pto";

  // How many hours to deduct (we rely on totalHours calculated when created)
  const hoursToDeduct = Number(item.totalHours ?? item.hours ?? 0);

  if (bucket !== "none") {
    if (!Number.isFinite(hoursToDeduct) || hoursToDeduct <= 0) {
      return NextResponse.json(
        { error: "Invalid hours on request (totalHours/hours missing)." },
        { status: 400 }
      );
    }

    const balances = await readBalances();
    const userKey = (item.userEmail || "").toLowerCase();

    if (!balances[userKey]) balances[userKey] = { ptoHours: 0, sickHours: 0 };

    if (bucket === "pto") {
      if (balances[userKey].ptoHours < hoursToDeduct) {
        return NextResponse.json(
          {
            error: `Insufficient PTO balance. Needs ${hoursToDeduct}, has ${balances[userKey].ptoHours}.`,
          },
          { status: 400 }
        );
      }
      balances[userKey].ptoHours -= hoursToDeduct;
    } else {
      if (balances[userKey].sickHours < hoursToDeduct) {
        return NextResponse.json(
          {
            error: `Insufficient Sick balance. Needs ${hoursToDeduct}, has ${balances[userKey].sickHours}.`,
          },
          { status: 400 }
        );
      }
      balances[userKey].sickHours -= hoursToDeduct;
    }

    await writeBalances(balances);
  }

  const now = new Date().toISOString();
  const actor = session?.user?.name || session?.user?.email || null;

  item.status = "approved";
  item.approvedBy = actor;
  item.approvedAt = now;
  item.deniedBy = null;
  item.deniedAt = null;
  item.updatedAt = now;

  await writeData(data);

  return NextResponse.json({
    ok: true,
    id,
    status: item.status,
    bucket,
    deductedHours: bucket === "none" ? 0 : hoursToDeduct,
  });
}
