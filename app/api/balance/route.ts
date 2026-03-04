import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { promises as fs } from "fs";
import path from "path";

const BALANCE_PATH = path.join(process.cwd(), "data", "balances.json");

export async function GET() {
  const session = await getServerSession();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const raw = await fs.readFile(BALANCE_PATH, "utf8");
    const balances = JSON.parse(raw);

    const userBalance = balances[email.toLowerCase()] || {
      pto: 0,
      sick: 0,
    };

    return NextResponse.json(userBalance);
  } catch {
    return NextResponse.json({ pto: 0, sick: 0 });
  }
}
