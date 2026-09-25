/** 12-hour time helpers for form Time / Date & Time fields. */

export type AmPm = "AM" | "PM";

export type TimeParts12 = {
  hour: string; // "1".."12"
  minute: string; // "00".."59"
  ampm: AmPm;
};

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export const TIME_HOUR_OPTIONS = HOURS_12;
export const TIME_MINUTE_OPTIONS = MINUTES;
export const TIME_AMPM_OPTIONS: AmPm[] = ["AM", "PM"];

/** Parse stored time: "14:30", "2:30 PM", "02:30PM", etc. */
export function parseTimeTo12h(raw: unknown): TimeParts12 | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  const ampmMatch = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = Number(ampmMatch[1]);
    const minute = ampmMatch[2];
    const ampm = ampmMatch[3].toUpperCase() as AmPm;
    if (h < 1 || h > 12 || Number(minute) > 59) return null;
    return { hour: String(h), minute, ampm };
  }

  const h24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24) {
    let h = Number(h24[1]);
    const minute = h24[2];
    if (h < 0 || h > 23 || Number(minute) > 59) return null;
    const ampm: AmPm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return { hour: String(h), minute, ampm };
  }

  return null;
}

export function formatTime12h(parts: TimeParts12): string {
  const hour = String(Number(parts.hour) || 12);
  const minute = String(parts.minute).padStart(2, "0");
  return `${hour}:${minute} ${parts.ampm}`;
}

export function emptyTimeParts(): TimeParts12 {
  return { hour: "", minute: "", ampm: "AM" };
}

/** Split datetime stored as "YYYY-MM-DDTHH:mm", "YYYY-MM-DD HH:mm", or "YYYY-MM-DD h:mm AM/PM". */
export function parseDateTimeValue(raw: unknown): { date: string; time: TimeParts12 | null } {
  const s = String(raw ?? "").trim();
  if (!s) return { date: "", time: null };

  const withAmPm = s.match(/^(\d{4}-\d{2}-\d{2})[ T](.+)$/);
  if (withAmPm) {
    return { date: withAmPm[1], time: parseTimeTo12h(withAmPm[2]) };
  }

  const dateOnly = s.match(/^\d{4}-\d{2}-\d{2}$/);
  if (dateOnly) return { date: s, time: null };

  return { date: "", time: parseTimeTo12h(s) };
}

export function formatDateTime12h(date: string, time: TimeParts12 | null): string {
  if (!date) return "";
  if (!time || !time.hour || !time.minute) return date;
  return `${date} ${formatTime12h(time)}`;
}

export function formatStoredTimeForDisplay(raw: unknown): string {
  const parts = parseTimeTo12h(raw);
  return parts && parts.hour && parts.minute ? formatTime12h(parts) : String(raw ?? "");
}

export function formatStoredDateTimeForDisplay(raw: unknown): string {
  const { date, time } = parseDateTimeValue(raw);
  if (!date && !time) return String(raw ?? "");
  if (date && time && time.hour && time.minute) return formatDateTime12h(date, time);
  if (date) return date;
  return time ? formatTime12h(time) : String(raw ?? "");
}
