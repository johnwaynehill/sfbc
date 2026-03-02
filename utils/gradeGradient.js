'use strict';

/**
 * gradeGradient.js
 *
 * Builds a CSS linear-gradient() string from a grade distribution array.
 * Each grade's tier colour is blended toward a warm-pebble BASE
 * in proportion to its count relative to the maximum count.
 * Grades with zero reviews show as the base tone.
 */

const GRADES = [
  'F', 'D-', 'D', 'D+', 'C-', 'C', 'C+',
  'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S',
];

// Tier palette — matches the app-wide grade badge colours
const COLORS = {
  'F':  [239, 68,  68],   // red
  'D-': [249, 115, 22],   // orange
  'D':  [249, 115, 22],
  'D+': [249, 115, 22],
  'C-': [120, 113, 108],  // warm stone
  'C':  [120, 113, 108],
  'C+': [120, 113, 108],
  'B-': [59,  130, 246],  // blue
  'B':  [59,  130, 246],
  'B+': [59,  130, 246],
  'A-': [34,  197, 94],   // green
  'A':  [34,  197, 94],
  'A+': [34,  197, 94],
  'S':  [245, 158, 11],   // gold
};

// Warm pebble — empty grades blend toward this neutral tone
const BASE = [228, 224, 218];

/**
 * Build a CSS linear-gradient string from a grade distribution.
 *
 * @param {Array<{grade: string, count: number}>} gradeDistribution
 * @returns {string} CSS linear-gradient value, e.g.
 *   "linear-gradient(to right, rgb(228,224,218) 0%, ...)"
 */
function buildGradeGradient(gradeDistribution) {
  const counts = new Map(gradeDistribution.map(r => [r.grade, r.count]));
  const maxCount = Math.max(0, ...[...counts.values()]);

  if (maxCount === 0) return `rgb(${BASE.join(',')})`;

  const stops = GRADES.map((g, i) => {
    const pct  = ((i / (GRADES.length - 1)) * 100).toFixed(2);
    const t    = (counts.get(g) ?? 0) / maxCount; // 0–1
    const [cr, cg, cb] = COLORS[g];
    const r  = Math.round(BASE[0] + (cr - BASE[0]) * t);
    const g_ = Math.round(BASE[1] + (cg - BASE[1]) * t);
    const b  = Math.round(BASE[2] + (cb - BASE[2]) * t);
    return `rgb(${r},${g_},${b}) ${pct}%`;
  });

  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/**
 * Map a letter grade to its percentage position along the strip (0–100).
 * Used as the CSS `left` value on the average-grade tick mark.
 *
 * @param {string} grade  e.g. "B+", "A-", "S"
 * @returns {number} 0-100
 */
function gradeToPercent(grade) {
  const i = GRADES.indexOf(grade);
  return i < 0 ? 50 : +((i / (GRADES.length - 1)) * 100).toFixed(2);
}

/**
 * Return the single-letter tier for a grade ('f', 'd', 'c', 'b', 'a', 's').
 * Used for the average-badge colour modifier.
 *
 * @param {string} grade
 * @returns {string|null}
 */
function gradeTier(grade) {
  if (!grade) return null;
  return grade.charAt(0).toLowerCase();
}

module.exports = { buildGradeGradient, gradeToPercent, gradeTier };
