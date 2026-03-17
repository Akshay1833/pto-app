import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { LEAVE_DEDUCT_RULES } from "@/lib/pto";
import { requireHr } from "../../_utils/isHr";
import { sendEmail } from "@/lib/email";

export async function POST(req: Request) {
  const session = await getServerSession();
  const hrEmail = session?.user?.email?.toLowerCase();

  if (!hrEmail) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const hr = await requireHr();

  if (hr.ok) {
    return NextResponse.json(
      { error: hr.ok ? "Unauthorized" : "Forbidden" },
      { status: hr.status }
    );
  }

  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({
        where: { email: hrEmail },
      });

      const item = await tx.leaveRequest.findUnique({
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
        throw new Error("Request not found");
      }

      if (item.status !== "pending") {
        throw new Error("Only pending requests can be approved.");
      }

      const bucket = LEAVE_DEDUCT_RULES[item.leaveType] ?? "pto";
      const hoursToDeduct = Number(item.totalHours ?? item.hours ?? 0);

      if (bucket !== "none") {
        if (!Number.isFinite(hoursToDeduct) || hoursToDeduct <= 0) {
          throw new Error("Invalid hours on request.");
        }

        const balance = item.user.balance;

        if (!balance) {
          throw new Error("Employee balance record not found.");
        }

        if (bucket === "pto") {
          if (balance.ptoHours < hoursToDeduct) {
            throw new Error(
              `Insufficient PTO balance. Needs ${hoursToDeduct}, has ${balance.ptoHours}.`
            );
          }

          await tx.balance.update({
            where: { userId: item.userId },
            data: {
              ptoHours: {
                decrement: hoursToDeduct,
              },
            },
          });
        } else {
          if (balance.sickHours < hoursToDeduct) {
            throw new Error(
              `Insufficient Sick balance. Needs ${hoursToDeduct}, has ${balance.sickHours}.`
            );
          }

          await tx.balance.update({
            where: { userId: item.userId },
            data: {
              sickHours: {
                decrement: hoursToDeduct,
              },
            },
          });
        }
      }

      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: "approved",
          approvedByUserId: actor?.id ?? null,
          approvedAt: new Date(),
          deniedByUserId: null,
          deniedAt: null,
        },
      });

      await sendEmail({
        to: item.user.email,
        subject: "PTO Request Approved",
        html: `
          <h2>Your PTO Request Was Approved</h2>
          <p><strong>Type:</strong> ${item.leaveType}</p>
          <p><strong>Dates:</strong> ${String(item.startDate).slice(
            0,
            10
          )} → ${String(item.endDate).slice(0, 10)}</p>
          <p><strong>Hours:</strong> ${hoursToDeduct}</p>
          <p><strong>Remaining PTO:</strong> ${
            bucket === "pto"
              ? (item.user.balance?.ptoHours ?? 0) - hoursToDeduct
              : item.user.balance?.ptoHours ?? 0
          } hrs</p>
          <p><strong>Remaining Sick:</strong> ${
            bucket === "sick"
              ? (item.user.balance?.sickHours ?? 0) - hoursToDeduct
              : item.user.balance?.sickHours ?? 0
          } hrs</p>
        `,
      });

      return {
        ok: true,
        id: updated.id,
        status: updated.status,
        bucket,
        deductedHours: bucket === "none" ? 0 : hoursToDeduct,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to approve request.";

    const status =
      message === "Request not found"
        ? 404
        : message.includes("Only pending")
        ? 400
        : message.includes("Insufficient")
        ? 400
        : message.includes("Invalid hours")
        ? 400
        : message.includes("Employee balance record not found")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
