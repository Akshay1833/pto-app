export const HOURS_PER_DAY = 8 as const;

export const LEAVE_TYPES = [
  "Vacation",
  "Personal leave",
  "Sick",
  "Jury duty",
  "Voting",
  "Bereavement",
  "Family medical leave",
  "Other",
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];
export type DurationType = "full_day" | "hourly";

export const LEAVE_DEDUCT_RULES: Record<string, "pto" | "sick" | "none"> = {
  Vacation: "pto",
  "Personal leave": "pto",
  Sick: "sick",
  "Jury duty": "none",
  Voting: "none",
  Bereavement: "none",
  "Family medical leave": "none",
  Other: "pto",
};

export function isValidLeaveType(x: unknown): x is LeaveType {
  return typeof x === "string" && (LEAVE_TYPES as readonly string[]).includes(x);
}

export function toDateOnly(d: string) {
  return new Date(`${d}T00:00:00.000Z`);
}

export function daysInclusive(start: string, end: string) {
  const s = toDateOnly(start).getTime();
  const e = toDateOnly(end).getTime();
  const diff = Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  const aS = toDateOnly(aStart).getTime();
  const aE = toDateOnly(aEnd).getTime();
  const bS = toDateOnly(bStart).getTime();
  const bE = toDateOnly(bEnd).getTime();
  return aS <= bE && bS <= aE;
}

export function randomId() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toLowerCase();
}

export function toYmd(date: Date) {
  return date.toISOString().slice(0, 10);
}