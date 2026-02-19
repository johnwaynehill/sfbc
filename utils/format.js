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

module.exports = { formatMonthYear, formatStatus, monthYearSlug, parseMonthYearSlug };
