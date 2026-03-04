import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { promises as fs } from "fs";
import path from "path";
import { requireHr } from "../../_utils/isHr";

const DATA_PATH = path.join(process.cwd(), "data", "pto.json");
const HR_EMAIL = "lkimbrough@bullzeyeequipment.com";
const BALANCE_PATH = path.join(process.cwd(), "data", "balances.json");

async function readBalances(): Promise<
  Record<string, { pto: number; sick: number }>
> {
  try {
    const raw = await fs.readFile(BALANCE_PATH, "utf8");
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

async function writeBalances(balances: any) {
  await fs.mkdir(path.dirname(BALANCE_PATH), { recursive: true });
  await fs.writeFile(BALANCE_PATH, JSON.stringify(balances, null, 2), "utf8");
}

function daysInclusive(startDate: string, endDate: string) {
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  const ms = e.getTime() - s.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days);
}

async function readData() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { requests: Array.isArray(parsed.requests) ? parsed.requests : [] };
  } catch {
    return { requests: [] };
  }
}

async function writeData(data: any) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const email = session?.user?.email;

  const hr = await requireHr();
  if (!hr.ok) {
    return NextResponse.json(
      {
        error: hr.status === 401 ? "Not signed in" : "Forbidden",
        email: hr.email,
      },
      { status: hr.status }
    );
  }

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const data = await readData();
  const item = data.requests.find((r: any) => r.id === id);

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotency: if already approved, do nothing (don’t double-deduct)
  if (item.status === "approved") {
    return NextResponse.json({ ok: true, alreadyApproved: true });
  }

  // Only deduct when moving from pending -> approved
  if (item.status !== "pending") {
    // denied -> approved (rare) OR other status; allow it if you want, but
    // safest: block changing final decisions
    return NextResponse.json(
      { error: "Only pending requests can be approved." },
      { status: 400 }
    );
  }

  const requestType = (item.type === "sick" ? "sick" : "pto") as "pto" | "sick";
  const days = daysInclusive(item.startDate, item.endDate);

  const balances = await readBalances();
  const userKey = (item.userEmail || "").toLowerCase();

  if (!balances[userKey]) {
    balances[userKey] = { pto: 0, sick: 0 };
  }

  if (balances[userKey][requestType] < days) {
    return NextResponse.json(
      {
        error: `Insufficient ${requestType.toUpperCase()} balance. Needs ${days}, has ${
          balances[userKey][requestType]
        }.`,
      },
      { status: 400 }
    );
  }

  // Deduct
  balances[userKey][requestType] -= days;

  item.status = "approved";
  item.updatedAt = new Date().toISOString();

  await writeData(data);
  await writeBalances(balances);

  return NextResponse.json({ ok: true, daysDeducted: days, type: requestType });
}
