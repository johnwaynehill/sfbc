'use strict';

const db = require('../db');
const { calculateResults } = require('./voting');

/* ------------------------------------------------------------------ */
/*  Dual-write helpers for monthly_picks                               */
/* ------------------------------------------------------------------ */

// Lazy-loaded to avoid circular deps and to tolerate pre-012 schema
let _monthlyPicksReady = null;

function monthlyPicksReady() {
  if (_monthlyPicksReady !== null) return _monthlyPicksReady;
  try {
    const cols = db.prepare("PRAGMA table_info(meetings)").all().map(c => c.name);
    _monthlyPicksReady = cols.includes('monthly_pick_id');
  } catch {
    _monthlyPicksReady = false;
  }
  return _monthlyPicksReady;
}

const dualWriteStatusStmt = () =>
  db.prepare("UPDATE monthly_picks SET status = ?, updated_at = datetime('now') WHERE id = ?");

const linkPickStmt = () =>
  db.prepare('UPDATE meetings SET monthly_pick_id = ? WHERE id = ?');

const createPickStmt = () =>
  db.prepare(`
    INSERT INTO monthly_picks (book_id, month_year, status, nominated_by, picked_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

const getPickIdStmt = () =>
  db.prepare('SELECT id FROM monthly_picks WHERE book_id = ? AND month_year = ?');

/* ------------------------------------------------------------------ */
/*  Prepared statements                                                */
/* ------------------------------------------------------------------ */

// Current meeting = the active one (reading, nominations, or voting status)
// Falls back to most recent non-results meeting, then most recent overall
const getCurrentStmt = db.prepare(`
  SELECT m.*, b.title AS book_title, b.author AS book_author, b.cover_url AS book_cover_url
  FROM meetings m
  LEFT JOIN books b ON b.id = m.winning_book_id
  WHERE m.status IN ('reading', 'nominations', 'voting')
  ORDER BY m.month_year DESC LIMIT 1
`);

const getUpcomingStmt = db.prepare(`
  SELECT m.*, b.title AS book_title, b.author AS book_author, b.cover_url AS book_cover_url
  FROM meetings m
  LEFT JOIN books b ON b.id = m.winning_book_id
  WHERE m.status = 'upcoming'
  ORDER BY m.month_year ASC
`);

const getByIdStmt = db.prepare(`
  SELECT m.*, b.title AS book_title, b.author AS book_author, b.cover_url AS book_cover_url
  FROM meetings m
  LEFT JOIN books b ON b.id = m.winning_book_id
  WHERE m.id = ?
`);
const getByMonthYearStmt = db.prepare(`
  SELECT m.*, b.title AS book_title, b.author AS book_author, b.cover_url AS book_cover_url
  FROM meetings m
  LEFT JOIN books b ON b.id = m.winning_book_id
  WHERE m.month_year = ?
`);

const getAllStmt = db.prepare(`
  SELECT m.*, b.title AS book_title, b.author AS book_author, b.cover_url AS book_cover_url
  FROM meetings m
  LEFT JOIN books b ON b.id = m.winning_book_id
  ORDER BY m.created_at DESC
`);

const createStmt = db.prepare(`
  INSERT INTO meetings (month_year, meetup_event_url, meeting_time, location_text, status)
  VALUES (?, ?, ?, ?, 'upcoming')
`);

const updateStmt = db.prepare(`
  UPDATE meetings
  SET month_year = ?, meetup_event_url = ?, meeting_time = ?, location_text = ?,
      updated_at = datetime('now')
  WHERE id = ?
`);

const updateStatusStmt = db.prepare(`
  UPDATE meetings SET status = ?, updated_at = datetime('now') WHERE id = ?
`);

const setWinnerStmt = db.prepare(`
  UPDATE meetings SET winning_book_id = ?, updated_at = datetime('now') WHERE id = ?
`);

const setNominationsOpenStmt = db.prepare(
  "UPDATE meetings SET nominations_open_at = datetime('now') WHERE id = ?"
);
const setNominationsCloseStmt = db.prepare(
  "UPDATE meetings SET nominations_close_at = datetime('now') WHERE id = ?"
);
const setVotingOpenStmt = db.prepare(
  "UPDATE meetings SET voting_open_at = datetime('now') WHERE id = ?"
);
const setVotingCloseStmt = db.prepare(
  "UPDATE meetings SET voting_close_at = datetime('now') WHERE id = ?"
);

const setResultsJsonStmt = db.prepare(
  "UPDATE meetings SET vote_results_json = ? WHERE id = ?"
);

const getNextUpcomingWithBookStmt = db.prepare(`
  SELECT id FROM meetings
  WHERE status = 'upcoming' AND winning_book_id IS NOT NULL
  ORDER BY month_year ASC LIMIT 1
`);

const getNomineesStmt = db.prepare(`
  SELECT mn.id AS nominee_id, mn.book_id, mn.source,
         b.title, b.author, b.cover_url, b.author_slug, b.title_slug,
         n.reason, u.display_name AS nominator_name
  FROM meeting_nominees mn
  JOIN books b ON b.id = mn.book_id
  LEFT JOIN nominations n ON n.meeting_id = mn.meeting_id AND n.book_id = mn.book_id
  LEFT JOIN users u ON u.id = n.user_id
  WHERE mn.meeting_id = ?
  ORDER BY mn.id ASC
`);

const addNomineeStmt = db.prepare(`
  INSERT OR IGNORE INTO meeting_nominees (meeting_id, book_id, source)
  VALUES (?, ?, 'admin_add')
`);

const removeNomineeStmt = db.prepare(
  'DELETE FROM meeting_nominees WHERE meeting_id = ? AND book_id = ?'
);

const removeNominationStmt = db.prepare(
  'DELETE FROM nominations WHERE meeting_id = ? AND book_id = ?'
);

const nomineeCountStmt = db.prepare(
  'SELECT COUNT(*) AS cnt FROM meeting_nominees WHERE meeting_id = ?'
);

const voteCountStmt = db.prepare(
  'SELECT COUNT(*) AS cnt FROM votes WHERE meeting_id = ?'
);

const countBooksStmt = db.prepare("SELECT COUNT(*) AS cnt FROM meetings WHERE status = 'results' AND winning_book_id IS NOT NULL");
const countMembersStmt = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'member'");
const countReviewsStmt = db.prepare('SELECT COUNT(*) AS cnt FROM reviews');

/* ------------------------------------------------------------------ */
/*  Valid status transitions                                           */
/* ------------------------------------------------------------------ */

const TRANSITIONS = {
  upcoming: ['reading', 'nominations'],
  reading: ['nominations'],
  nominations: ['voting'],
  voting: ['results'],
};

/* ------------------------------------------------------------------ */
/*  Exported functions                                                 */
/* ------------------------------------------------------------------ */

function getCurrent() {
  return getCurrentStmt.get() || null;
}

function getUpcoming() {
  return getUpcomingStmt.all();
}

function getById(id) {
  return getByIdStmt.get(id) || null;
}

function getByMonthYear(monthYear) {
  return getByMonthYearStmt.get(monthYear) || null;
}

function getAll() {
  return getAllStmt.all();
}

function create({ month_year, meetup_event_url, meeting_time, location_text }) {
  const info = createStmt.run(
    month_year,
    meetup_event_url || null,
    meeting_time || null,
    location_text || null,
  );
  return getByIdStmt.get(info.lastInsertRowid);
}

function update(id, { month_year, meetup_event_url, meeting_time, location_text }) {
  updateStmt.run(
    month_year,
    meetup_event_url || null,
    meeting_time || null,
    location_text || null,
    id,
  );
  return getByIdStmt.get(id);
}

/**
 * Advance a meeting's status to the next valid state.
 * Returns { meeting } on success or { error } on failure.
 *
 * Normal flow:  upcoming → reading → nominations → voting → results
 * Alt flow:     upcoming → nominations → voting → results  (no pre-selected book)
 * Shortcut:     reading → voting  (skip nominations when book is pre-selected)
 *
 * When finalized to results, the next upcoming meeting with a pre-selected
 * book is automatically advanced to "reading".
 */
function advanceStatus(id, newStatus) {
  const meeting = getByIdStmt.get(id);
  if (!meeting) return { error: 'Meeting not found.' };

  const allowed = TRANSITIONS[meeting.status] || [];

  // Allow the normal transitions, plus reading→results shortcut (close meeting)
  // and reading→voting shortcut (skip nominations)
  const isCloseReading = meeting.status === 'reading' && newStatus === 'results';
  const isSkipToVoting = meeting.status === 'reading' && newStatus === 'voting';
  if (!isCloseReading && !isSkipToVoting && !allowed.includes(newStatus)) {
    return { error: `Cannot transition from "${meeting.status}" to "${newStatus}".` };
  }

  // Preflight checks
  if (newStatus === 'voting') {
    const count = nomineeCountStmt.get(id).cnt;
    if (count < 2) {
      return { error: 'Need at least 2 nominees before starting voting.' };
    }
  }

  if (newStatus === 'results' && !isCloseReading) {
    const count = voteCountStmt.get(id).cnt;
    if (count < 1) {
      return { error: 'Need at least 1 vote before finalizing results.' };
    }
  }

  // Perform transition in a transaction
  db.transaction(() => {
    // Only one meeting can be "reading" at a time — close any other
    if (newStatus === 'reading') {
      const closedRows = db.prepare(
        "SELECT id, monthly_pick_id FROM meetings WHERE status = 'reading' AND id != ?"
      ).all(id);
      db.prepare(
        "UPDATE meetings SET status = 'results', updated_at = datetime('now') WHERE status = 'reading' AND id != ?"
      ).run(id);
      // Dual-write: close the monthly_pick too
      if (monthlyPicksReady()) {
        for (const row of closedRows) {
          if (row.monthly_pick_id) {
            dualWriteStatusStmt().run('results', row.monthly_pick_id);
          }
        }
      }
    }

    // Set timestamps
    if (newStatus === 'nominations') {
      setNominationsOpenStmt.run(id);
    } else if (newStatus === 'voting') {
      if (!isSkipToVoting) {
        setNominationsCloseStmt.run(id);
      }
      setVotingOpenStmt.run(id);
    } else if (newStatus === 'results') {
      if (!isCloseReading) {
        setVotingCloseStmt.run(id);
      }

      // Auto-set winning book from voting results (only if voting occurred)
      if (!isCloseReading) {
        const results = calculateResults(id);
        if (results.rankings.length > 0) {
          setWinnerStmt.run(results.rankings[0].book_id, id);
        }
        // Persist full results JSON for instant loading and archival
        setResultsJsonStmt.run(JSON.stringify(results), id);
      }
    }

    updateStatusStmt.run(newStatus, id);

    // ---- Dual-write to monthly_picks ----
    if (monthlyPicksReady()) {
      const updated = getByIdStmt.get(id);
      if (updated && updated.monthly_pick_id) {
        // Meeting already linked — just sync status
        dualWriteStatusStmt().run(newStatus, updated.monthly_pick_id);
      } else if (updated && updated.winning_book_id && newStatus === 'results') {
        // Transitioning to results with a winner — create a monthly_pick if none exists
        const existing = getPickIdStmt().get(updated.winning_book_id, updated.month_year);
        if (existing) {
          dualWriteStatusStmt().run(newStatus, existing.id);
          linkPickStmt().run(existing.id, id);
        } else {
          // Look up nominator for this book
          const nom = db.prepare(
            'SELECT user_id FROM nominations WHERE meeting_id = ? AND book_id = ? LIMIT 1'
          ).get(id, updated.winning_book_id);
          createPickStmt().run(
            updated.winning_book_id,
            updated.month_year,
            newStatus,
            nom ? nom.user_id : null
          );
          const newPick = getPickIdStmt().get(updated.winning_book_id, updated.month_year);
          if (newPick) {
            linkPickStmt().run(newPick.id, id);
          }
        }
      }
    }
  })();

  return { meeting: getByIdStmt.get(id) };
}

function getNominees(meetingId) {
  return getNomineesStmt.all(meetingId);
}

function addNominee(meetingId, bookId) {
  return addNomineeStmt.run(meetingId, bookId);
}

const removeNomineeTxn = db.transaction((meetingId, bookId) => {
  removeNominationStmt.run(meetingId, bookId);
  removeNomineeStmt.run(meetingId, bookId);
});

function removeNominee(meetingId, bookId) {
  removeNomineeTxn(meetingId, bookId);
}

function getStats() {
  return {
    totalBooks: countBooksStmt.get().cnt,
    totalMembers: countMembersStmt.get().cnt,
    totalReviews: countReviewsStmt.get().cnt,
  };
}

/**
 * Force-set a meeting's status, bypassing normal transition validation.
 * Intended for admin override when the normal flow gets stuck.
 */
function forceStatus(id, newStatus) {
  updateStatusStmt.run(newStatus, id);
}

/**
 * Permanently delete a meeting and all associated data.
 * Only intended for super-admin use.
 */
const deleteMeetingTxn = db.transaction((id) => {
  db.prepare('DELETE FROM votes WHERE meeting_id = ?').run(id);
  db.prepare('DELETE FROM nominations WHERE meeting_id = ?').run(id);
  db.prepare('DELETE FROM meeting_nominees WHERE meeting_id = ?').run(id);
  db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
});

function deleteById(id) {
  deleteMeetingTxn(id);
}

module.exports = {
  getCurrent,
  getUpcoming,
  getById,
  getByMonthYear,
  getAll,
  create,
  update,
  advanceStatus,
  getNominees,
  addNominee,
  removeNominee,
  getStats,
  forceStatus,
  deleteById,
};
