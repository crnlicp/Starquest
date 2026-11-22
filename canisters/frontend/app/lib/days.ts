// Family days, as the backend counts them: whole days since 1970 in the family's time zone.
const DAY_MS = 86_400_000;

export function todayDay(tzOffsetMinutes: number): number {
  return Math.floor((Date.now() + tzOffsetMinutes * 60_000) / DAY_MS);
}

// A day number as a date; format it with timeZone "UTC" so the browser's own zone does not shift it.
export const dayToDate = (day: number) => new Date(day * DAY_MS);

export const dayFormat = (language: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(language, { ...options, timeZone: "UTC" });

// "2026-11-21" from a date input, and back.
export const inputToDay = (value: string) => (value ? Math.floor(Date.parse(`${value}T00:00:00Z`) / DAY_MS) : null);
export const dayToInput = (day: number) => dayToDate(day).toISOString().slice(0, 10);

export const nsToDate = (ns: bigint) => new Date(Number(ns / 1_000_000n));
