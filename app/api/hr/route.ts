import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { requireHr } from "../_utils/isHr"; // same helper you already use in admin routes

export async function GET() {
  const session = await getServerSession();
  const email = session?.user?.email?.toLowerCase();

  if (!email) return NextResponse.json({ isHr: false });

  // requireHr returns { ok: true, email } for HR, or { ok: false } for non-HR
  const hr = await requireHr();
  return NextResponse.json({ isHr: hr.ok });
}