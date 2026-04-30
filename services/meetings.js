'use strict';

const db = require('../db');

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
  WHERE m.status IN ('scheduled', 'upcoming')
  ORDER BY m.month_year ASC
`);

const getByIdStmt = db.prepare(`
  SELECT m.*, b.title AS book_title, b.author AS book_author, b.cover_url AS book_cover_url
  FROM meetings m
  LEFT JOIN books b ON b.id = m.winning_book_id
  WHERE m.id = ?
`);

const getByPickIdStmt = db.prepare(`
  SELECT m.*, b.title AS book_title, b.author AS book_author, b.cover_url AS book_cover_url
  FROM meetings m
  LEFT JOIN books b ON b.id = m.winning_book_id
  WHERE m.monthly_pick_id = ?
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
  VALUES (?, ?, ?, ?, 'scheduled')
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

const updateTopicStmt = db.prepare(
  "UPDATE meetings SET topic = ?, updated_at = datetime('now') WHERE id = ?"
);

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

const countBooksStmt = db.prepare("SELECT COUNT(*) AS cnt FROM monthly_picks WHERE status = 'results'");
const countMembersStmt = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'member'");
const countReviewsStmt = db.prepare('SELECT COUNT(*) AS cnt FROM reviews');

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

function getByPickId(pickId) {
  return getByPickIdStmt.get(pickId) || null;
}

/**
 * Simple status sync — update meeting status without lifecycle logic.
 * Called by the picks service to keep the meeting in sync after the pick
 * (the lifecycle owner) advances its own status.
 */
function syncStatus(meetingId, newStatus) {
  updateStatusStmt.run(newStatus, meetingId);
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

function updateTopic(id, topic) {
  updateTopicStmt.run(topic || null, id);
  return getByIdStmt.get(id);
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
  getByPickId,
  getByMonthYear,
  getAll,
  create,
  update,
  updateTopic,
  getNominees,
  addNominee,
  removeNominee,
  getStats,
  forceStatus,
  syncStatus,
  deleteById,
};
