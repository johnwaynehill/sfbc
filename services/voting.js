'use strict';

const db = require('../db');

/* ------------------------------------------------------------------ */
/*  Seeded shuffle (deterministic per-user ballot order)               */
/* ------------------------------------------------------------------ */

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Fisher-Yates shuffle using mulberry32 PRNG.
 * Same seed always produces the same order.
 */
function seededShuffle(array, seed) {
  let t = hashString(String(seed)) | 0;

  function random() {
    t = (t + 0x6D2B79F5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/* ------------------------------------------------------------------ */
/*  Ballot data                                                        */
/* ------------------------------------------------------------------ */

const nomineesQuery = db.prepare(`
  SELECT
    mn.id   AS nominee_id,
    mn.book_id,
    b.title,
    b.author,
    b.cover_url,
    b.publication_year,
    b.page_count,
    b.google_books_id,
    b.open_library_id,
    b.isbn,
    b.author_slug,
    b.title_slug,
    n.reason,
    u.display_name AS nominator_name
  FROM meeting_nominees mn
  JOIN books b ON b.id = mn.book_id
  LEFT JOIN nominations n
    ON n.meeting_id = mn.meeting_id AND n.book_id = mn.book_id
  LEFT JOIN users u ON u.id = n.user_id
  WHERE mn.meeting_id = ?
  ORDER BY mn.id ASC
`);

/**
 * Get all nominees for a meeting with full book + nomination metadata.
 */
function getNomineesForBallot(meetingId) {
  return nomineesQuery.all(meetingId);
}

/* ------------------------------------------------------------------ */
/*  Vote checks                                                        */
/* ------------------------------------------------------------------ */

const hasVotedStmt = db.prepare(
  'SELECT 1 FROM votes WHERE meeting_id = ? AND submitted_fingerprint = ? LIMIT 1'
);

function hasVoted(meetingId, fingerprint) {
  return !!hasVotedStmt.get(meetingId, fingerprint);
}

const voteCountStmt = db.prepare(
  'SELECT COUNT(*) AS cnt FROM votes WHERE meeting_id = ?'
);

function getVoteCount(meetingId) {
  return voteCountStmt.get(meetingId).cnt;
}

/* ------------------------------------------------------------------ */
/*  Results calculation                                                */
/* ------------------------------------------------------------------ */

const votesQuery = db.prepare(
  'SELECT ranking_json FROM votes WHERE meeting_id = ?'
);

/**
 * Calculate ranked results for a meeting.
 * Points: rank 1 = N points, rank 2 = N-1, ..., rank N = 1
 * where N is the number of nominees.
 */
function calculateResults(meetingId) {
  const nominees = getNomineesForBallot(meetingId);
  const N = nominees.length;
  const votes = votesQuery.all(meetingId);

  // Initialize points map
  const points = {};
  for (const nom of nominees) {
    points[nom.book_id] = 0;
  }

  // Tally points from each vote
  for (const vote of votes) {
    const ranking = JSON.parse(vote.ranking_json);
    for (let i = 0; i < ranking.length; i++) {
      const bookId = ranking[i];
      if (bookId in points) {
        points[bookId] += (N - i); // rank 0 → N pts, rank 1 → N-1, etc.
      }
    }
  }

  // Build sorted results
  const results = nominees.map(nom => ({
    ...nom,
    points: points[nom.book_id] || 0,
  }));
  results.sort((a, b) => b.points - a.points);

  const maxPoints = results.length > 0 ? results[0].points : 0;

  return {
    rankings: results.map((r, i) => ({
      ...r,
      rank: i + 1,
      pct: maxPoints > 0 ? Math.round((r.points / maxPoints) * 100) : 0,
    })),
    voteCount: votes.length,
    maxPoints,
  };
}

module.exports = {
  seededShuffle,
  getNomineesForBallot,
  hasVoted,
  getVoteCount,
  calculateResults,
};
