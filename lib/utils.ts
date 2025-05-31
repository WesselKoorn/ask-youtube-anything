import { startOfDay, parseISO } from 'date-fns';

/**
 * Compare two dates in UTC, normalizing them to midnight UTC
 * @param date1 First date (string or Date)
 * @param date2 Second date (string or Date)
 * @returns true if date1 is greater than or equal to date2
 */
export function isDateAfter(date1: string | Date, date2: string | Date): boolean {
  const d1 = startOfDay(parseISO(date1.toString()));
  const d2 = startOfDay(parseISO(date2.toString()));
  return d1 > d2;
} 