import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function requireHr() {
  const session = await getServerSession();
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return { ok: false as const, status: 401 as const, email: null };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { isHr: true },
  });

  if (!user?.isHr) {
    return { ok: false as const, status: 403 as const, email };
  }

  return { ok: true as const, status: 200 as const, email };
}
