import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { requireHr } from "../_utils/isHr";

export async function GET(req: Request) {
  const session = await getServerSession();
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "1";

  if (all) {
    const hr = await requireHr();

    if (!hr.ok) {
      return NextResponse.json(
        { error: hr.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: hr.status }
      );
    }

    const users = await prisma.user.findMany({
      include: {
        balance: true,
      },
      orderBy: {
        email: "asc",
      },
    });

    const balances: Record<string, { ptoHours: number; sickHours: number }> =
      {};

    for (const user of users) {
      balances[user.email.toLowerCase()] = {
        ptoHours: user.balance?.ptoHours ?? 0,
        sickHours: user.balance?.sickHours ?? 0,
      };
    }

    return NextResponse.json({ balances });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      balance: true,
    },
  });

  return NextResponse.json({
    ptoHours: user?.balance?.ptoHours ?? 0,
    sickHours: user?.balance?.sickHours ?? 0,
  });
}