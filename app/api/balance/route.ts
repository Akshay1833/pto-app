import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { promises as fs } from "fs";
import path from "path";
import { requireHr } from "../_utils/isHr";

const BALANCE_PATH = path.join(process.cwd(), "data", "balances.json");

type Balance = { ptoHours: number; sickHours: number };
type BalanceMap = Record<string, Balance>;

async function readBalances(): Promise<BalanceMap> {
  try {
    const raw = await fs.readFile(BALANCE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeBalance(v: any): Balance {
  // Supports both old keys (pto/sick) and new keys (ptoHours/sickHours)
  const ptoHours = Number(v?.ptoHours ?? v?.pto ?? 0);
  const sickHours = Number(v?.sickHours ?? v?.sick ?? 0);
  return {
    ptoHours: Number.isFinite(ptoHours) ? ptoHours : 0,
    sickHours: Number.isFinite(sickHours) ? sickHours : 0,
  };
}

export async function GET(req: Request) {
  const session = await getServerSession();
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "1";

  const balances = await readBalances();

  // HR: return all balances
  if (all) {
    const hr = await requireHr();
    if (!hr.ok) {
      return NextResponse.json(
        { error: hr.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: hr.status }
      );
    }

    const normalized: BalanceMap = {};
    for (const [k, v] of Object.entries(balances)) {
      normalized[k.toLowerCase()] = normalizeBalance(v);
    }

    return NextResponse.json({ balances: normalized });
  }

  // Employee: return only current user's balance
  const userKey = email.toLowerCase();
  const userBalance = normalizeBalance(balances[userKey]);

  return NextResponse.json(userBalance);
}
