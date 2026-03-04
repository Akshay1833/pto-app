import { getServerSession } from "next-auth";

const HR_EMAILS = [
  "adhakan@bullzeyeequipment.com", // TEMP: you
  "lkimbrough@bullzeyeequipment.com", // real HR
].map((e) => e.toLowerCase());

export async function requireHr() {
  const session = await getServerSession();
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    return { ok: false as const, status: 401 as const, email: null };
  }

  if (!HR_EMAILS.includes(email)) {
    return { ok: false as const, status: 403 as const, email };
  }

  return { ok: true as const, status: 200 as const, email };
}
