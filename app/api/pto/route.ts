import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { promises as fs } from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "pto.json");

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
  type: "pto" | "sick";
};

async function readData(): Promise<{ requests: PTORequest[] }> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { requests: Array.isArray(parsed.requests) ? parsed.requests : [] };
  } catch {
    return { requests: [] };
  }
}

async function writeData(data: { requests: PTORequest[] }) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function randomId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ).toLowerCase();
}

// GET /api/pto  -> current user's requests
export async function GET() {
  const session = await getServerSession(); // works because you already set up NextAuth route
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const data = await readData();
  const mine = data.requests.filter((r) => r.userEmail === email);

  return NextResponse.json({ requests: mine });
}

// POST /api/pto -> create request for current user
export async function POST(req: Request) {
  const session = await getServerSession();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const startDate = body?.startDate;
  const endDate = body?.endDate;
  const reason = body?.reason;
  const type = body?.type;

  if (
    !startDate ||
    !endDate ||
    !reason ||
    (type !== "pto" && type !== "sick")
  ) {
    return NextResponse.json(
      { error: "Missing startDate, endDate, reason, or invalid type" },
      { status: 400 }
    );
  }

  const data = await readData();
  const now = new Date().toISOString();

  const newReq: PTORequest = {
    id: randomId(),
    userEmail: email,
    userName: session?.user?.name ?? null,
    startDate,
    endDate,
    reason,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    type,
  };

  data.requests.push(newReq);
  await writeData(data);

  return NextResponse.json({ request: newReq }, { status: 201 });
}
