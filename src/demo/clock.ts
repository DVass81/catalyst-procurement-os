const DAY_MS = 86_400_000;

function utcDate(value: string | Date) {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
    );
  }
  return new Date(`${value.slice(0, 10)}T12:00:00Z`);
}

export function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function sessionDate(value: string | Date = new Date()) {
  return toIsoDate(utcDate(value));
}

export function addCalendarDays(value: string, amount: number) {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return toIsoDate(date);
}

export function addBusinessDays(value: string, amount: number) {
  const direction = amount < 0 ? -1 : 1;
  let remaining = Math.abs(amount);
  const date = utcDate(value);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + direction);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return toIsoDate(date);
}

export function calendarDayDifference(from: string, to: string) {
  return Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / DAY_MS);
}

export function businessDayDifference(from: string, to: string) {
  const direction = utcDate(to) >= utcDate(from) ? 1 : -1;
  let cursor = from;
  let count = 0;
  while (cursor !== to) {
    cursor = addCalendarDays(cursor, direction);
    const day = utcDate(cursor).getUTCDay();
    if (day !== 0 && day !== 6) count += direction;
  }
  return count;
}

export function shiftFromAnchor(
  originalDate: string,
  targetSessionDate: string,
  anchor = "2026-07-24",
) {
  return addCalendarDays(
    targetSessionDate,
    calendarDayDifference(anchor, originalDate),
  );
}

export function approvalEscalationStatus(
  asOfDate: string,
  dueDate: string,
): "none" | "approaching_due" | "overdue" {
  const remaining = businessDayDifference(asOfDate, dueDate);
  if (remaining < 0) return "overdue";
  if (remaining <= 1) return "approaching_due";
  return "none";
}

export function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcDate(value));
}
