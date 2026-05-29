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
    b.description,
    b.subjects,
    b.publisher,
    b.language,
    n.reason,
    COALESCE(n.nominator_name, u.display_name) AS nominator_name
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

const hasUserVotedStmt = db.prepare(
  'SELECT 1 FROM votes WHERE meeting_id = ? AND user_id = ? LIMIT 1'
);

/**
 * Whether a logged-in user has already voted in this meeting. Unlike hasVoted
 * (keyed by per-browser fingerprint), this catches the same user voting from a
 * different browser/cookie. Returns false for anonymous voters (no userId).
 */
function hasUserVoted(meetingId, userId) {
  if (!userId) return false;
  return !!hasUserVotedStmt.get(meetingId, userId);
}

const voteCountStmt = db.prepare(
  'SELECT COUNT(*) AS cnt FROM votes WHERE meeting_id = ?'
);

function getVoteCount(meetingId) {
  return voteCountStmt.get(meetingId).cnt;
}

/* ------------------------------------------------------------------ */
/*  Admin: individual votes for a meeting                              */
/* ------------------------------------------------------------------ */

const votesForMeetingStmt = db.prepare(`
  SELECT v.id, v.ranking_json, v.submitted_fingerprint, v.created_at,
         v.user_id, v.submitted_ip_hash, u.display_name, u.email
  FROM votes v
  LEFT JOIN users u ON u.id = v.user_id
  WHERE v.meeting_id = ?
  ORDER BY v.created_at ASC
`);

/**
 * Votes for a meeting, enriched for the admin inspector. Each row gains:
 *   - ip_cluster_count: how many votes in this meeting share its IP hash
 *     (1 when alone or when the hash is null/legacy)
 *   - network_label: first 6 hex chars of the IP hash for visual grouping
 *     (null when no hash). This is a soft, review-only signal — votes are
 *     never auto-rejected on it.
 */
function getVotesForMeeting(meetingId) {
  const votes = votesForMeetingStmt.all(meetingId);

  // Tally how many votes share each (non-null) IP hash.
  const counts = new Map();
  for (const v of votes) {
    if (!v.submitted_ip_hash) continue;
    counts.set(v.submitted_ip_hash, (counts.get(v.submitted_ip_hash) || 0) + 1);
  }

  return votes.map((v) => ({
    ...v,
    ip_cluster_count: v.submitted_ip_hash ? counts.get(v.submitted_ip_hash) : 1,
    network_label: v.submitted_ip_hash ? v.submitted_ip_hash.slice(0, 6) : null,
  }));
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
  hasUserVoted,
  getVoteCount,
  getVotesForMeeting,
  calculateResults,
};
