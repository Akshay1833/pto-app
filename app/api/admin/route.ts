import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { promises as fs } from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "pto.json");
const HR_EMAIL = "adhakan@bullzeyeequipment.com";

async function readData() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { requests: Array.isArray(parsed.requests) ? parsed.requests : [] };
  } catch {
    return { requests: [] };
  }
}

export async function GET() {
  const session = await getServerSession();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (email.toLowerCase() !== HR_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await readData();
  return NextResponse.json({ requests: data.requests });
}
