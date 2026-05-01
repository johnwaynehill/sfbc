'use strict';

const db = require('../db');
const { calculateResults } = require('./voting');

// Lazy-loaded to avoid circular deps (meetings.js also requires this file indirectly)
let _meetings = null;
function meetingsService() {
  if (!_meetings) _meetings = require('./meetings');
  return _meetings;
}

/* ------------------------------------------------------------------ */
/*  Prepared statements                                                */
/* ------------------------------------------------------------------ */

const getCurrentStmt = db.prepare(`
  SELECT mp.*, b.title, b.author, b.cover_url, b.author_slug, b.title_slug,
         u.display_name AS nominator_name
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  LEFT JOIN users u ON u.id = mp.nominated_by
  WHERE mp.status = 'reading'
  ORDER BY mp.month_year DESC LIMIT 1
`);

const getByMonthYearStmt = db.prepare(`
  SELECT mp.*, b.title, b.author, b.cover_url, b.author_slug, b.title_slug,
         u.display_name AS nominator_name
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  LEFT JOIN users u ON u.id = mp.nominated_by
  WHERE mp.month_year = ?
`);

const getByIdStmt = db.prepare(`
  SELECT mp.*, b.title, b.author, b.cover_url, b.author_slug, b.title_slug,
         u.display_name AS nominator_name
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  LEFT JOIN users u ON u.id = mp.nominated_by
  WHERE mp.id = ?
`);

const getAllStmt = db.prepare(`
  SELECT mp.*, b.title, b.author, b.cover_url, b.author_slug, b.title_slug,
         u.display_name AS nominator_name
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  LEFT JOIN users u ON u.id = mp.nominated_by
  ORDER BY mp.month_year DESC
`);

const createStmt = db.prepare(`
  INSERT INTO monthly_picks (book_id, month_year, status, nominated_by, topic, picked_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
`);

const updateTopicStmt = db.prepare(
  "UPDATE monthly_picks SET topic = ?, updated_at = datetime('now') WHERE id = ?"
);

const updateStatusStmt = db.prepare(`
  UPDATE monthly_picks SET status = ?, updated_at = datetime('now') WHERE id = ?
`);

const getByBookAndMonthStmt = db.prepare(`
  SELECT id FROM monthly_picks WHERE book_id = ? AND month_year = ?
`);

/* ------------------------------------------------------------------ */
/*  Lifecycle prepared statements (Phase 3: picks own the state machine) */
/* ------------------------------------------------------------------ */

const setPickNominationsOpenStmt = db.prepare(
  "UPDATE monthly_picks SET nominations_open_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
);
const setPickNominationsCloseStmt = db.prepare(
  "UPDATE monthly_picks SET nominations_close_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
);
const setPickVotingOpenStmt = db.prepare(
  "UPDATE monthly_picks SET voting_open_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
);
const setPickVotingCloseStmt = db.prepare(
  "UPDATE monthly_picks SET voting_close_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
);
const setPickResultsJsonStmt = db.prepare(
  "UPDATE monthly_picks SET vote_results_json = ?, updated_at = datetime('now') WHERE id = ?"
);
const updatePickBookIdStmt = db.prepare(
  "UPDATE monthly_picks SET book_id = ?, updated_at = datetime('now') WHERE id = ?"
);

// Meeting-side statements for lifecycle sync
const meetingSetWinnerStmt = db.prepare(
  "UPDATE meetings SET winning_book_id = ?, updated_at = datetime('now') WHERE id = ?"
);
const meetingSetNominationsOpenStmt = db.prepare(
  "UPDATE meetings SET nominations_open_at = datetime('now') WHERE id = ?"
);
const meetingSetNominationsCloseStmt = db.prepare(
  "UPDATE meetings SET nominations_close_at = datetime('now') WHERE id = ?"
);
const meetingSetVotingOpenStmt = db.prepare(
  "UPDATE meetings SET voting_open_at = datetime('now') WHERE id = ?"
);
const meetingSetVotingCloseStmt = db.prepare(
  "UPDATE meetings SET voting_close_at = datetime('now') WHERE id = ?"
);
const meetingSetResultsJsonStmt = db.prepare(
  "UPDATE meetings SET vote_results_json = ? WHERE id = ?"
);
const meetingUpdateStatusStmt = db.prepare(
  "UPDATE meetings SET status = ?, updated_at = datetime('now') WHERE id = ?"
);

const nomineeCountStmt = db.prepare(
  'SELECT COUNT(*) AS cnt FROM meeting_nominees WHERE meeting_id = ?'
);
const voteCountStmt = db.prepare(
  'SELECT COUNT(*) AS cnt FROM votes WHERE meeting_id = ?'
);

const linkPickToMeetingStmt = db.prepare(
  'UPDATE meetings SET monthly_pick_id = ? WHERE id = ?'
);

/* ------------------------------------------------------------------ */
/*  Read-side queries (Phase 3: books as primary entity)               */
/* ------------------------------------------------------------------ */

/**
 * Home hero: the current active pick with full book data.
 * Prefers non-results (active lifecycle), falls back to most recent completed.
 */
const getHeroStmt = db.prepare(`
  SELECT mp.*, b.id AS book_id, b.title, b.author, b.cover_url, b.open_library_id,
         b.publication_year, b.page_count, b.author_slug, b.title_slug,
         b.description, b.subjects
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.status = 'reading'
  ORDER BY mp.month_year ASC
  LIMIT 1
`);

const getHeroFallbackStmt = db.prepare(`
  SELECT mp.*, b.id AS book_id, b.title, b.author, b.cover_url, b.open_library_id,
         b.publication_year, b.page_count, b.author_slug, b.title_slug,
         b.description, b.subjects
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.status = 'results'
  ORDER BY mp.month_year DESC
  LIMIT 1
`);

/**
 * Recent completed picks for home page strip.
 * Optionally excludes a specific pick (the hero).
 */
const getRecentPicksStmt = db.prepare(`
  SELECT mp.month_year, mp.status, b.id AS book_id, b.title, b.author,
         b.cover_url, b.open_library_id, b.author_slug, b.title_slug,
         (SELECT AVG(gw.weight) FROM reviews r2
          JOIN grade_weights gw ON gw.grade = r2.grade
          WHERE r2.book_id = b.id) AS avg_weight,
         (SELECT COUNT(*) FROM reviews r3 WHERE r3.book_id = b.id) AS review_count
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.status = 'results'
  ORDER BY mp.month_year DESC
`);

const getRecentPicksExcludingStmt = db.prepare(`
  SELECT mp.month_year, mp.status, b.id AS book_id, b.title, b.author,
         b.cover_url, b.open_library_id, b.author_slug, b.title_slug,
         (SELECT AVG(gw.weight) FROM reviews r2
          JOIN grade_weights gw ON gw.grade = r2.grade
          WHERE r2.book_id = b.id) AS avg_weight,
         (SELECT COUNT(*) FROM reviews r3 WHERE r3.book_id = b.id) AS review_count
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.status = 'results' AND mp.id != ?
  ORDER BY mp.month_year DESC
`);

/** Total completed picks count. */
const countCompletedStmt = db.prepare(
  "SELECT COUNT(*) AS cnt FROM monthly_picks WHERE status = 'results'"
);

/** History page: all completed picks with grade + review info. */
const getHistoryStmt = db.prepare(`
  SELECT mp.month_year, mp.status, b.id AS book_id, b.title, b.author,
         b.cover_url, b.open_library_id, b.author_slug, b.title_slug,
         b.subjects,
         (SELECT AVG(gw.weight) FROM reviews r2
          JOIN grade_weights gw ON gw.grade = r2.grade
          WHERE r2.book_id = b.id) AS avg_weight,
         (SELECT COUNT(*) FROM reviews r3 WHERE r3.book_id = b.id) AS review_count
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.status = 'results'
  ORDER BY mp.month_year DESC
`);

/** Book detail lookup: find pick info for a specific book. */
const getPickForBookStmt = db.prepare(`
  SELECT mp.month_year, mp.status AS pick_status
  FROM monthly_picks mp
  WHERE mp.book_id = ?
  ORDER BY mp.month_year DESC
  LIMIT 1
`);

/** Get the first event for a pick (for meeting-details-bar display). */
const getFirstEventStmt = db.prepare(`
  SELECT meeting_time, location_text, meetup_event_url
  FROM events
  WHERE monthly_pick_id = ?
  ORDER BY meeting_time ASC
  LIMIT 1
`);

/* ------------------------------------------------------------------ */
/*  Exported functions                                                 */
/* ------------------------------------------------------------------ */

/**
 * Get the currently active monthly pick (reading, nominations, or voting).
 */
function getCurrent() {
  return getCurrentStmt.get() || null;
}

/**
 * Get a monthly pick by month_year string (e.g., "2026-03").
 */
function getByMonthYear(monthYear) {
  return getByMonthYearStmt.get(monthYear) || null;
}

/**
 * Get a monthly pick by ID.
 */
function getById(id) {
  return getByIdStmt.get(id) || null;
}

/**
 * Get all monthly picks, most recent first.
 */
function getAll() {
  return getAllStmt.all();
}

/**
 * Create a new monthly pick.
 * @param {number} bookId - The book selected for this month
 * @param {string} monthYear - e.g., "2026-03"
 * @param {string} [status='upcoming'] - Initial status
 * @param {number|null} [nominatedBy=null] - User ID of nominator
 * @returns {object} The created monthly pick row
 */
function create(bookId, monthYear, status = 'upcoming', nominatedBy = null, topic = null) {
  const info = createStmt.run(bookId, monthYear, status, nominatedBy, topic || null);
  return getByIdStmt.get(info.lastInsertRowid);
}

/**
 * Update the topic/theme for a pick.
 */
function updateTopic(id, topic) {
  updateTopicStmt.run(topic || null, id);
  return getByIdStmt.get(id);
}

/**
 * Simple status update (no lifecycle validation).
 * Used by forceStatus and internal helpers.
 */
function advanceStatus(id, newStatus) {
  updateStatusStmt.run(newStatus, id);
  return getByIdStmt.get(id);
}

/* ------------------------------------------------------------------ */
/*  Lifecycle state machine (Phase 3: picks own transitions)           */
/* ------------------------------------------------------------------ */

const TRANSITIONS = {
  scheduled: ['nominations'],             // open nominations on a new pick
  nominations: ['voting'],
  voting: ['upcoming'],                   // close voting → determine winner → upcoming (with book)
  upcoming: ['reading'],                  // upcoming (with book) → start reading
  reading: ['results'],                   // finish reading → done
};

/**
 * Advance a meeting's lifecycle status. The pick service is the lifecycle
 * owner — it validates transitions, manages timestamps, calculates results,
 * and creates/links picks as needed.
 *
 * Entry point: meeting ID (for backward compat with admin UI).
 * Internally writes to both the meeting and its linked pick.
 *
 * Flow:  scheduled → nominations → voting → upcoming (with book) → reading → results
 *
 * When voting closes the winner is determined and the meeting returns to
 * "upcoming" with winning_book_id set. The admin later manually advances
 * to "reading" when the club is ready.
 *
 * @param {number} meetingId - meetings.id
 * @param {string} newStatus - Target status
 * @returns {{ meeting: object } | { error: string }}
 */
function advanceMeetingStatus(meetingId, newStatus) {
  const ms = meetingsService();
  const meeting = ms.getById(meetingId);
  if (!meeting) return { error: 'Meeting not found.' };

  const allowed = TRANSITIONS[meeting.status] || [];
  if (!allowed.includes(newStatus)) {
    return { error: `Cannot transition from "${meeting.status}" to "${newStatus}".` };
  }

  // Preflight checks
  if (newStatus === 'voting') {
    const count = nomineeCountStmt.get(meetingId).cnt;
    if (count < 2) {
      return { error: 'Need at least 2 nominees before starting voting.' };
    }
  }

  if (meeting.status === 'voting' && newStatus === 'upcoming') {
    const count = voteCountStmt.get(meetingId).cnt;
    if (count < 1) {
      return { error: 'Need at least 1 vote before closing voting.' };
    }
  }

  if (newStatus === 'reading' && !meeting.winning_book_id) {
    return { error: 'Cannot start reading without a selected book. Run nominations and voting first.' };
  }

  // Perform transition in a transaction
  db.transaction(() => {
    // Only one meeting can be "reading" at a time — close any other
    if (newStatus === 'reading') {
      const others = db.prepare(
        "SELECT id, monthly_pick_id FROM meetings WHERE status = 'reading' AND id != ?"
      ).all(meetingId);
      db.prepare(
        "UPDATE meetings SET status = 'results', updated_at = datetime('now') WHERE status = 'reading' AND id != ?"
      ).run(meetingId);
      // Close their linked picks too
      for (const row of others) {
        if (row.monthly_pick_id) {
          updateStatusStmt.run('results', row.monthly_pick_id);
        }
      }
    }

    // --- Set timestamps on the meeting ---
    if (newStatus === 'nominations') {
      meetingSetNominationsOpenStmt.run(meetingId);
    } else if (newStatus === 'voting') {
      meetingSetNominationsCloseStmt.run(meetingId);
      meetingSetVotingOpenStmt.run(meetingId);
    } else if (meeting.status === 'voting' && newStatus === 'upcoming') {
      // Close voting → determine winner
      meetingSetVotingCloseStmt.run(meetingId);

      const results = calculateResults(meetingId);
      if (results.rankings.length > 0) {
        meetingSetWinnerStmt.run(results.rankings[0].book_id, meetingId);
      }
      meetingSetResultsJsonStmt.run(JSON.stringify(results), meetingId);
    }

    // Update meeting status
    meetingUpdateStatusStmt.run(newStatus, meetingId);

    // --- Mirror to linked pick (canonical lifecycle entity) ---
    const updated = db.prepare(
      'SELECT * FROM meetings WHERE id = ?'
    ).get(meetingId);

    if (updated && updated.monthly_pick_id) {
      // Pick exists — sync status + timestamps
      updateStatusStmt.run(newStatus, updated.monthly_pick_id);

      if (newStatus === 'nominations') {
        setPickNominationsOpenStmt.run(updated.monthly_pick_id);
      } else if (newStatus === 'voting') {
        setPickNominationsCloseStmt.run(updated.monthly_pick_id);
        setPickVotingOpenStmt.run(updated.monthly_pick_id);
      } else if (meeting.status === 'voting' && newStatus === 'upcoming') {
        setPickVotingCloseStmt.run(updated.monthly_pick_id);
        if (updated.vote_results_json) {
          setPickResultsJsonStmt.run(updated.vote_results_json, updated.monthly_pick_id);
        }
        if (updated.winning_book_id) {
          updatePickBookIdStmt.run(updated.winning_book_id, updated.monthly_pick_id);
        }
      }
    } else if (updated && updated.winning_book_id && meeting.status === 'voting' && newStatus === 'upcoming') {
      // No pick yet but we have a winner — create the pick
      const existing = getByBookAndMonthStmt.get(updated.winning_book_id, updated.month_year);
      if (existing) {
        // Pick already exists for this book+month — link and sync
        updateStatusStmt.run('upcoming', existing.id);
        linkPickToMeetingStmt.run(existing.id, meetingId);
        if (updated.vote_results_json) {
          setPickResultsJsonStmt.run(updated.vote_results_json, existing.id);
        }
      } else {
        // Create new pick
        const nom = db.prepare(
          'SELECT user_id FROM nominations WHERE meeting_id = ? AND book_id = ? LIMIT 1'
        ).get(meetingId, updated.winning_book_id);
        createStmt.run(
          updated.winning_book_id,
          updated.month_year,
          'upcoming',
          nom ? nom.user_id : null,
          null
        );
        const newPick = getByBookAndMonthStmt.get(updated.winning_book_id, updated.month_year);
        if (newPick) {
          linkPickToMeetingStmt.run(newPick.id, meetingId);
          if (updated.vote_results_json) {
            setPickResultsJsonStmt.run(updated.vote_results_json, newPick.id);
          }
        }
      }
    }
  })();

  return { meeting: ms.getById(meetingId) };
}

/**
 * Find an existing monthly pick by book + month.
 * Useful for checking if a pick already exists before creating one.
 */
function findByBookAndMonth(bookId, monthYear) {
  return getByBookAndMonthStmt.get(bookId, monthYear) || null;
}

/* ------------------------------------------------------------------ */
/*  Phase 3: Read-side functions (books as primary entity)             */
/* ------------------------------------------------------------------ */

/**
 * Get the hero pick for the home page.
 * Prefers active lifecycle (reading/nominations/voting), falls back to most recent completed.
 */
function getHero() {
  return getHeroStmt.get() || getHeroFallbackStmt.get() || null;
}

/**
 * Get recent completed picks for the home page strip.
 * @param {number} limit - Max picks to return
 * @param {number|null} [excludePickId] - Pick to exclude (e.g., the hero)
 */
function getRecentPicks(limit, excludePickId = null) {
  if (excludePickId) {
    return getRecentPicksExcludingStmt.all(excludePickId).slice(0, limit);
  }
  return getRecentPicksStmt.all().slice(0, limit);
}

/**
 * Count total completed picks (books the club has read).
 */
function countCompleted() {
  return countCompletedStmt.get().cnt;
}

/**
 * Get all completed picks for the history page.
 */
function getHistory() {
  return getHistoryStmt.all();
}

/**
 * Get pick info for a specific book (for book detail page).
 * Returns { month_year, pick_status } or null.
 */
function getPickForBook(bookId) {
  return getPickForBookStmt.get(bookId) || null;
}

/**
 * Get the first scheduled event for a pick.
 * Returns { meeting_time, location_text, meetup_event_url } or null.
 */
function getFirstEvent(pickId) {
  return getFirstEventStmt.get(pickId) || null;
}

/**
 * Get all events for a pick, ordered by meeting_time.
 */
function getEvents(pickId) {
  return db.prepare(
    'SELECT * FROM events WHERE monthly_pick_id = ? ORDER BY meeting_time ASC'
  ).all(pickId);
}

/**
 * Create a new event for a pick.
 */
function createEvent(pickId, { meeting_time, location_text, meetup_event_url }) {
  const result = db.prepare(
    'INSERT INTO events (monthly_pick_id, meeting_time, location_text, meetup_event_url) VALUES (?, ?, ?, ?)'
  ).run(pickId, meeting_time || null, location_text || null, meetup_event_url || null);
  return db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Update an event (with pick ownership check).
 */
function updateEvent(pickId, eventId, { meeting_time, location_text, meetup_event_url }) {
  const event = db.prepare('SELECT * FROM events WHERE id = ? AND monthly_pick_id = ?').get(eventId, pickId);
  if (!event) return null;
  db.prepare(
    'UPDATE events SET meeting_time = ?, location_text = ?, meetup_event_url = ? WHERE id = ?'
  ).run(meeting_time || null, location_text || null, meetup_event_url || null, eventId);
  return db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
}

/**
 * Delete an event (with pick ownership check).
 */
function deleteEvent(pickId, eventId) {
  const event = db.prepare('SELECT * FROM events WHERE id = ? AND monthly_pick_id = ?').get(eventId, pickId);
  if (!event) return false;
  db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
  return true;
}

/**
 * Get adjacent picks (prev/next) by month_year for book-to-book navigation.
 * Returns { prev: {...} | null, next: {...} | null }
 */
const getPrevPickStmt = db.prepare(`
  SELECT mp.month_year, b.title, b.author, b.author_slug, b.title_slug, b.cover_url
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.month_year < ? AND mp.status = 'results'
  ORDER BY mp.month_year DESC
  LIMIT 1
`);

const getNextPickStmt = db.prepare(`
  SELECT mp.month_year, b.title, b.author, b.author_slug, b.title_slug, b.cover_url
  FROM monthly_picks mp
  JOIN books b ON b.id = mp.book_id
  WHERE mp.month_year > ? AND mp.status IN ('results', 'reading')
  ORDER BY mp.month_year ASC
  LIMIT 1
`);

function getAdjacentPicks(monthYear) {
  if (!monthYear) return { prev: null, next: null };
  return {
    prev: getPrevPickStmt.get(monthYear) || null,
    next: getNextPickStmt.get(monthYear) || null,
  };
}

module.exports = {
  getCurrent,
  getByMonthYear,
  getById,
  getAll,
  create,
  advanceStatus,
  advanceMeetingStatus,
  findByBookAndMonth,
  getHero,
  getRecentPicks,
  countCompleted,
  getHistory,
  getPickForBook,
  getFirstEvent,
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getAdjacentPicks,
  updateTopic,
};
