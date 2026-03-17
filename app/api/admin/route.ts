import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHr } from "../_utils/isHr";

function toYmd(date: Date) {
  return date.toISOString().slice(0, 10);
}

type AdminRequestRow = {
  id: string;
  totalHours: number | null;
  reason: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  deniedAt: Date | null;
  startDate: Date;
  endDate: Date;
  durationType: string;
  leaveType: string;
  user: {
    email: string;
    name: string | null;
  };
  approvedBy: {
    email: string;
    name: string | null;
  } | null;
  deniedBy: {
    email: string;
    name: string | null;
  } | null;
};

export async function GET() {
  const hr = await requireHr();

  if (!hr.ok) {
    return NextResponse.json(
      { error: hr.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: hr.status }
    );
  }

  const requests: AdminRequestRow[] = await prisma.leaveRequest.findMany({
    include: {
      user: true,
      approvedBy: true,
      deniedBy: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      userEmail: r.user.email,
      userName: r.user.name ?? null,
      leaveType: r.leaveType,
      durationType: r.durationType,
      startDate: toYmd(r.startDate),
      endDate: toYmd(r.endDate),
      hours: r.totalHours,
      totalHours: r.totalHours,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      approvedBy: r.approvedBy?.email ?? null,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      deniedBy: r.deniedBy?.email ?? null,
      deniedAt: r.deniedAt?.toISOString() ?? null,
    })),
  });
}
