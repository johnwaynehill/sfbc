'use strict';

const db = require('../db');
const picksService = require('../services/monthly-picks');
const { parseMonthYearSlug, monthYearSlug } = require('./format');

/**
 * Resolve a month from a slug or numeric ID.
 * Returns { pick, meeting, monthYear, slug } or null.
 *
 * - `meeting` always exists when the return value is non-null
 * - `pick` may be null (nominations phase — no book selected yet)
 * - `slug` is the canonical URL slug (e.g. "january-2026")
 */
function resolveMonth(slugOrId) {
  let meeting = null;

  // Try month-year slug first (e.g. "january-2026")
  const monthYear = parseMonthYearSlug(slugOrId);
  if (monthYear) {
    meeting = db.prepare('SELECT * FROM meetings WHERE month_year = ?').get(monthYear) || null;
  } else {
    // Fall back to numeric ID for backward compatibility
    const id = parseInt(slugOrId, 10);
    if (!isNaN(id)) {
      meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) || null;
    }
  }

  if (!meeting) return null;

  // Resolve the linked pick (may be null if no book selected yet)
  const pick = picksService.getByMonthYear(meeting.month_year);

  return {
    pick,
    meeting,
    monthYear: meeting.month_year,
    slug: monthYearSlug(meeting.month_year),
  };
}

module.exports = { resolveMonth };
