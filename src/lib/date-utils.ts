import { format, differenceInMinutes, differenceInHours, differenceInCalendarDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const APP_TIMEZONE = "Asia/Kolkata";

/**
 * Returns current timestamp in Asia/Kolkata zone
 */
export function getNowInKolkata(): Date {
  return toZonedTime(new Date(), APP_TIMEZONE);
}

/**
 * Converts any UTC/ISO date string to Asia/Kolkata zoned Date
 */
export function toKolkataDate(date: string | Date): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return toZonedTime(d, APP_TIMEZONE);
}

/**
 * Format a date nicely in Asia/Kolkata timezone (e.g. "Mon, 20 Oct · 11:59 PM")
 */
export function formatKolkataDateTime(date: string | Date): string {
  const zoned = toKolkataDate(date);
  return format(zoned, "EEE, d MMM · h:mm a");
}

/**
 * Format date for table/short view (e.g. "20 Oct, 11:59 PM")
 */
export function formatKolkataShort(date: string | Date): string {
  const zoned = toKolkataDate(date);
  return format(zoned, "d MMM, h:mm a");
}

/**
 * Converts a datetime-local input string ("2026-10-20T23:59")
 * interpreted strictly as Asia/Kolkata into a UTC ISO string for PostgreSQL
 */
export function kolkataLocalToUTC(localDateString: string): string {
  if (!localDateString) return "";
  // Ensure seconds are included if not present
  const normalized = localDateString.length === 16 ? `${localDateString}:00` : localDateString;
  const utcDate = fromZonedTime(normalized, APP_TIMEZONE);
  return utcDate.toISOString();
}

/**
 * Converts a UTC ISO string to the value required by an HTML <input type="datetime-local">
 * formatted in Asia/Kolkata ("yyyy-MM-dd'T'HH:mm")
 */
export function utcToKolkataLocalInput(isoString?: string | null): string {
  if (!isoString) return "";
  const zoned = toKolkataDate(isoString);
  return format(zoned, "yyyy-MM-dd'T'HH:mm");
}

export interface CountdownResult {
  label: string;
  isOverdue: boolean;
  isExpiringSoon: boolean; // Overdue but within the 4-day auto-removal window
  vanishWarning?: string;  // e.g. "Vanishes in 2 days"
}

/**
 * Computes peer-style countdown text relative to now in Asia/Kolkata
 * Auto-removal rule: visible for 4 days after due date, then auto-vanishes from student view.
 */
export function getDueCountdown(dueAtInput: string | Date): CountdownResult {
  const dueDate = toKolkataDate(dueAtInput);
  const now = getNowInKolkata();

  const diffMinutes = differenceInMinutes(dueDate, now);
  const diffHours = differenceInHours(dueDate, now);
  const diffDays = differenceInCalendarDays(dueDate, now);

  if (diffMinutes < 0) {
    // Overdue
    const absDiffDays = Math.abs(diffDays);
    const absDiffHours = Math.abs(diffHours);

    // Days remaining in the 4-day grace window before disappearing
    const daysUntilVanish = 4 - absDiffDays;

    let overdueLabel = "";
    if (absDiffDays === 0) {
      overdueLabel = `overdue by ${absDiffHours <= 1 ? "1 hr" : `${absDiffHours} hrs`}`;
    } else if (absDiffDays === 1) {
      overdueLabel = "overdue by 1 day";
    } else {
      overdueLabel = `overdue by ${absDiffDays} days`;
    }

    const vanishWarning =
      daysUntilVanish <= 1
        ? "Vanishes in < 24h"
        : `Vanishes in ${daysUntilVanish} days`;

    return {
      label: overdueLabel,
      isOverdue: true,
      isExpiringSoon: daysUntilVanish >= 0,
      vanishWarning: daysUntilVanish >= 0 ? vanishWarning : "Expired",
    };
  }

  // Due in future or today
  if (diffDays === 0) {
    if (diffHours <= 0) {
      return {
        label: `due in ${Math.max(1, diffMinutes)} mins`,
        isOverdue: false,
        isExpiringSoon: false,
      };
    }
    return {
      label: `due in ${diffHours} hr${diffHours === 1 ? "" : "s"} (today)`,
      isOverdue: false,
      isExpiringSoon: false,
    };
  }

  if (diffDays === 1) {
    return {
      label: "due tomorrow",
      isOverdue: false,
      isExpiringSoon: false,
    };
  }

  return {
    label: `due in ${diffDays} days`,
    isOverdue: false,
    isExpiringSoon: false,
  };
}
