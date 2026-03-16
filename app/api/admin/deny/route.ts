import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { promises as fs } from "fs";
import path from "path";
import { requireHr } from "../../_utils/isHr";
import { sendEmail } from "../../_utils/email";

const DATA_PATH = path.join(process.cwd(), "data", "pto.json");
const BALANCES_PATH = path.join(process.cwd(), "data", "balances.json");

type PTORequest = {
  type: any;
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
type Balances = Record<
  string,
  {
    pto: number;
    sick: number;
  }
>;

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

async function readBalances(): Promise<Balances> {
  try {
    const raw = await fs.readFile(BALANCES_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeData(data: { requests: PTORequest[] }) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
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
  const balances = await readBalances();
  const item = data.requests.find((r) => r.id === id);

  if (!item) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Only pending can be denied (keeps decisions final, avoids weird state)
  if (item.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending requests can be denied." },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const actor = session?.user?.name || session?.user?.email || null;

  item.status = "denied";
  item.deniedBy = actor;
  item.deniedAt = now;
  item.approvedBy = null;
  item.approvedAt = null;
  item.updatedAt = now;

  const remainingPto = balances[item.userEmail]?.pto ?? 0;
  const remainingSick = balances[item.userEmail]?.sick ?? 0;

  await writeData(data);
  await sendEmail({
    to: item.userEmail,
    subject: "Your PTO Request Was Denied",
    html: `
    <h2>PTO Request Denied</h2>
    <p>Hello ${item.userName || item.userEmail},</p>
    <p>Your request has been <strong>denied</strong>.</p>
    <p><strong>Leave Type:</strong> ${item.leaveType}</p>
    <p><strong>Duration:</strong> ${item.durationType}</p>
    <p><strong>Total Hours:</strong> ${item.totalHours}</p>
    <p><strong>Start Date:</strong> ${item.startDate}</p>
    <p><strong>End Date:</strong> ${item.endDate}</p>
    <p><strong>Reason:</strong> ${item.reason}</p>
    <p><strong>Current PTO Balance:</strong> ${remainingPto} hours</p>
    <p><strong>Current Sick Balance:</strong> ${remainingSick} hours</p>
  `,
  });

  return NextResponse.json({
    ok: true,
    id,
    status: item.status,
  });
}
