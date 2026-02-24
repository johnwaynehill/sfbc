'use strict';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * "2026-01" → "January 2026"
 */
function formatMonthYear(monthYear) {
  if (!monthYear) return '';
  const [year, month] = monthYear.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES[idx] || month} ${year}`;
}

/**
 * Human-readable status labels
 */
const STATUS_LABELS = {
  upcoming: 'Upcoming',
  reading: 'Currently Reading',
  nominations: 'Nominations Open',
  voting: 'Voting Open',
  results: 'Finished',
};

function formatStatus(status) {
  return STATUS_LABELS[status] || status;
}

/**
 * "2026-01" → "january-2026" (URL-friendly slug)
 */
function monthYearSlug(monthYear) {
  if (!monthYear) return '';
  const [year, month] = monthYear.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${(MONTH_NAMES[idx] || month).toLowerCase()}-${year}`;
}

/**
 * "january-2026" → "2026-01" (reverse of monthYearSlug)
 */
function parseMonthYearSlug(slug) {
  if (!slug) return null;
  const match = slug.match(/^([a-z]+)-(\d{4})$/);
  if (!match) return null;
  const monthIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === match[1]);
  if (monthIdx === -1) return null;
  return `${match[2]}-${String(monthIdx + 1).padStart(2, '0')}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a datetime-local string (e.g. "2026-02-25T18:30") without timezone conversion.
 * Parses the string directly to avoid UTC/local timezone mismatches on the server.
 *
 * Options:
 *   long:  "Wednesday, Feb 25 at 6:30 PM" (default)
 *   short: "Wed, Feb 25"
 *   time:  "6:30 PM"
 */
function formatMeetingTime(dtStr, style) {
  if (!dtStr) return '';
  // Parse "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD HH:MM" directly
  const match = dtStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return dtStr;
  const [, yearStr, monthStr, dayStr, hourStr, minStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);

  // Calculate day-of-week using a known reference (Date constructor with explicit parts)
  // We use UTC methods to avoid any local timezone shift
  const d = new Date(Date.UTC(year, month, day));
  const dow = d.getUTCDay();

  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  const timeStr = min === 0 ? `${h12} ${ampm}` : `${h12}:${String(min).padStart(2, '0')} ${ampm}`;

  if (style === 'short') {
    return `${DAY_NAMES_SHORT[dow]}, ${MONTH_NAMES_SHORT[month]} ${day}`;
  }
  if (style === 'time') {
    return timeStr;
  }
  // long (default)
  return `${DAY_NAMES[dow]}, ${MONTH_NAMES_SHORT[month]} ${day} at ${timeStr}`;
}

module.exports = { formatMonthYear, formatStatus, monthYearSlug, parseMonthYearSlug, formatMeetingTime };
