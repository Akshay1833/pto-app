import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { requireHr } from "../../_utils/isHr";
import { sendEmail } from "@/lib/email";

export async function POST(req: Request) {
  const session = await getServerSession();
  const hrEmail = session?.user?.email?.toLowerCase();

  if (!hrEmail) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const hr = await requireHr();
  if (!hr.ok) {
    return NextResponse.json(
      { error: hr.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: hr.status }
    );
  }

  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const actor = await prisma.user.findUnique({
    where: { email: hrEmail },
  });

  const item = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          balance: true,
        },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (item.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending requests can be denied." },
      { status: 400 }
    );
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: "denied",
      deniedByUserId: actor?.id ?? null,
      deniedAt: new Date(),
      approvedByUserId: null,
      approvedAt: null,
    },
  });

  await sendEmail({
    to: item.user.email,
    subject: "PTO Request Denied",
    html: `
      <h2>Your PTO Request was Denied</h2>
      <p><strong>Type:</strong> ${item.leaveType}</p>
      <p><strong>Dates:</strong> ${item.startDate
        .toISOString()
        .slice(0, 10)} → ${item.endDate.toISOString().slice(0, 10)}</p>
      <p><strong>Hours:</strong> ${item.totalHours}</p>
      <hr />
      <p><strong>Remaining PTO:</strong> ${
        item.user.balance?.ptoHours ?? 0
      } hrs</p>
      <p><strong>Remaining Sick:</strong> ${
        item.user.balance?.sickHours ?? 0
      } hrs</p>
    `,
  });

  return NextResponse.json({
    ok: true,
    id: updated.id,
    status: updated.status,
  });
}
