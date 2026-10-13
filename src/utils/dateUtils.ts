import { format, isValid, startOfToday, isBefore } from "date-fns";

/**
 * Safely formats a date. Returns a fallback string if the date is invalid.
 * @param date The date to format (Date object, string, or number)
 * @param formatStr The format string (e.g., "MMM d, yyyy")
 * @param fallback The string to return if the date is invalid (default: "N/A")
 */
export function safeFormat(
  date: Date | string | number | undefined | null, 
  formatStr: string, 
  fallback: string = "N/A"
): string {
  if (date === undefined || date === null || date === "") return fallback;
  
  const d = new Date(date);
  if (!isValid(d)) return fallback;
  
  try {
    return format(d, formatStr);
  } catch (error) {
    console.error("Error formatting date:", error, { date, formatStr });
    return fallback;
  }
}

/**
 * Safely converts a date to an ISO string. Returns null if invalid.
 */
export function safeToISOString(date: Date | string | number | undefined | null): string | null {
  if (date === undefined || date === null || date === "") return null;
  
  const d = new Date(date);
  if (!isValid(d)) return null;
  
  return d.toISOString();
}

/**
 * Validates a yyyy-MM-dd deadline from a date input. New or changed deadlines must be today or later;
 * an existing item's unchanged deadline is always fine, so overdue work can still be edited and completed.
 */
export function deadlineError(newDate: string, originalDate?: string | null): string | null {
  if (!newDate) return "Please select a deadline.";
  if (originalDate && safeFormat(originalDate, "yyyy-MM-dd") === newDate) return null;
  return newDate < new Date().toLocaleDateString("en-CA") ? "Deadline must be today or a future date." : null;
}

/**
 * Checks if a given date is strictly overdue relative to the start of today.
 * A task due later today is NOT considered overdue.
 */
export function isOverdue(date: Date | string | number | undefined | null): boolean {
  if (date === undefined || date === null || date === "") return false;
  
  const d = new Date(date);
  if (!isValid(d)) return false;
  
  return isBefore(d, startOfToday());
}
