/**
 * shared/dateUtils.ts
 * Date utilities shared between pipeline export scripts.
 * Uses Luxon for reliable parsing and formatting.
 */

import { DateTime } from 'luxon';

/**
 * Extract an ISO date string (YYYY-MM-DD) from a model ID that embeds a date.
 *
 * Handles:
 *   - YYYY-MM-DD  (e.g. "o3-mini-2025-01-31-high")
 *   - YYYYMMDD    (e.g. "claude-3-7-sonnet-20250219")
 *
 * Returns null when no valid date is found.
 */
export function extractDate(id: string): string | null {
  // YYYY-MM-DD
  const m1 = id.match(/(\d{4}-\d{2}-\d{2})/);
  if (m1) {
    const dt = DateTime.fromISO(m1[1], { zone: 'utc' });
    if (dt.isValid) return dt.toISODate()!;
  }

  // YYYYMMDD — must be followed by a non-digit or end of string
  const m2 = id.match(/(\d{8})(?:\D|$)/);
  if (m2) {
    const dt = DateTime.fromFormat(m2[1], 'yyyyMMdd', { zone: 'utc' });
    if (dt.isValid) return dt.toISODate()!;
  }

  return null;
}

/**
 * Convert a Unix timestamp (seconds since epoch) to an ISO date string YYYY-MM-DD.
 */
export function unixToDate(ts: number): string {
  return DateTime.fromSeconds(ts, { zone: 'utc' }).toISODate()!;
}
