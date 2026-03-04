import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { promises as fs } from "fs";
import path from "path";
import { requireHr } from "../../_utils/isHr";

const DATA_PATH = path.join(process.cwd(), "data", "pto.json");
const HR_EMAIL = "lkimbrough@bullzeyeequipment.com";

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

  item.status = "denied";
  item.updatedAt = new Date().toISOString();

  await writeData(data);
  return NextResponse.json({ ok: true });
}
