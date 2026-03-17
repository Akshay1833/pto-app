import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import {
  HOURS_PER_DAY,
  isValidLeaveType,
  daysInclusive,
  rangesOverlap,
  randomId,
  toYmd,
} from "@/lib/pto";

type DurationType = "full_day" | "hourly";

type UserPtoRequestRow = {
  id: string;
  leaveType: string;
  durationType: string;
  startDate: Date;
  endDate: Date;
  hours: number | null;
  totalHours: number | null;
  reason: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  deniedAt: Date | null;
};

export async function GET() {
  const session = await getServerSession();
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return NextResponse.json({ requests: [] });
  }

  const requests: UserPtoRequestRow[] = await prisma.leaveRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      userEmail: email,
      userName: session?.user?.name ?? null,
      leaveType: r.leaveType,
      durationType: r.durationType,
      startDate: toYmd(r.startDate),
      endDate: toYmd(r.endDate),
      hours: r.hours,
      totalHours: r.totalHours,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      approvedBy: null,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      deniedBy: null,
      deniedAt: r.deniedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const email = session?.user?.email?.toLowerCase();
  const name = session?.user?.name ?? null;

  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  const leaveType = body?.leaveType as unknown;
  const durationType = body?.durationType as unknown;
  const startDate = body?.startDate as unknown;
  const endDate = body?.endDate as unknown;
  const reason = body?.reason as unknown;
  const hours = body?.hours as unknown;

  if (!isValidLeaveType(leaveType)) {
    return NextResponse.json({ error: "Invalid leave type" }, { status: 400 });
  }

  if (durationType !== "full_day" && durationType !== "hourly") {
    return NextResponse.json(
      { error: "Invalid duration type" },
      { status: 400 }
    );
  }

  if (typeof startDate !== "string" || !startDate.trim()) {
    return NextResponse.json(
      { error: "Start date is required" },
      { status: 400 }
    );
  }

  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  let normalizedEndDate = startDate;
  let totalHours = 0;
  let hourlyHours: number | null = null;

  if (durationType === "hourly") {
    const h = Number(hours);

    if (!Number.isFinite(h) || h <= 0 || h > HOURS_PER_DAY) {
      return NextResponse.json(
        { error: "Hours must be between 0.25 and 8" },
        { status: 400 }
      );
    }

    const rounded = Math.round(h * 4) / 4;
    if (Math.abs(rounded - h) > 1e-9) {
      return NextResponse.json(
        { error: "Hours must be in 0.25 increments (e.g., 1.5, 2.25)" },
        { status: 400 }
      );
    }

    hourlyHours = h;
    totalHours = h;
  } else {
    if (typeof endDate !== "string" || !endDate.trim()) {
      return NextResponse.json(
        { error: "End date is required for full-day leave" },
        { status: 400 }
      );
    }

    normalizedEndDate = endDate;
    totalHours = daysInclusive(startDate, normalizedEndDate) * HOURS_PER_DAY;
  }

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        balance: {
          create: {
            ptoHours: 0,
            sickHours: 0,
          },
        },
      },
    });
  } else {
    const existingBalance = await prisma.balance.findUnique({
      where: { userId: user.id },
    });

    if (!existingBalance) {
      await prisma.balance.create({
        data: {
          userId: user.id,
          ptoHours: 0,
          sickHours: 0,
        },
      });
    }
  }

  const existing: Array<{ startDate: Date; endDate: Date }> =
    await prisma.leaveRequest.findMany({
      where: {
        userId: user.id,
        status: { not: "denied" },
      },
      orderBy: { createdAt: "desc" },
    });

  const overlap = existing.some((r) =>
    rangesOverlap(
      startDate,
      normalizedEndDate,
      toYmd(r.startDate),
      toYmd(r.endDate)
    )
  );

  if (overlap) {
    return NextResponse.json(
      { error: "This request overlaps with an existing leave request." },
      { status: 400 }
    );
  }

  const created = await prisma.leaveRequest.create({
    data: {
      id: randomId(),
      userId: user.id,
      leaveType,
      durationType: durationType as DurationType,
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: new Date(`${normalizedEndDate}T00:00:00.000Z`),
      hours: hourlyHours,
      totalHours,
      reason: reason.trim(),
      status: "pending",
    },
  });

  const currentBalance = await prisma.balance.findUnique({
    where: { userId: user.id },
  });

  await sendEmail({
    to: process.env.HR_EMAIL || "lkimbrough@bullzeyeequipment.com",
    subject: "New PTO Request",
    html: `
      <h2>New PTO Request</h2>
      <p><strong>Employee:</strong> ${name ?? email}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Type:</strong> ${leaveType}</p>
      <p><strong>Dates:</strong> ${startDate} - ${normalizedEndDate}</p>
      <p><strong>Hours:</strong> ${totalHours}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <hr />
      <p><strong>Current PTO Balance:</strong> ${
        currentBalance?.ptoHours ?? 0
      } hrs</p>
      <p><strong>Current Sick Balance:</strong> ${
        currentBalance?.sickHours ?? 0
      } hrs</p>
    `,
  });

  return NextResponse.json(
    {
      request: {
        id: created.id,
        userEmail: email,
        userName: name,
        leaveType: created.leaveType,
        durationType: created.durationType,
        startDate: toYmd(created.startDate),
        endDate: toYmd(created.endDate),
        hours: created.hours,
        totalHours: created.totalHours,
        reason: created.reason,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        approvedBy: null,
        approvedAt: null,
        deniedBy: null,
        deniedAt: null,
      },
    },
    { status: 201 }
  );
}