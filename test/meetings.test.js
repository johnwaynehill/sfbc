'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { db, freshDb, seedUser, seedBook, seedMeeting, seedNominee } = require('./setup');

let meetings;

describe('meetings service', () => {
  beforeEach(() => {
    freshDb();
    meetings = require('../services/meetings');
  });

  describe('create', () => {
    it('creates a meeting with default scheduled status', () => {
      const meeting = meetings.create({ month_year: '2026-06' });
      assert.ok(meeting);
      assert.equal(meeting.month_year, '2026-06');
      assert.equal(meeting.status, 'scheduled');
    });

    it('stores optional fields', () => {
      const meeting = meetings.create({
        month_year: '2026-07',
        meeting_time: '2026-07-15T18:30',
        location_text: 'Main Library',
        meetup_event_url: 'https://meetup.com/event/123',
      });
      assert.equal(meeting.meeting_time, '2026-07-15T18:30');
      assert.equal(meeting.location_text, 'Main Library');
    });
  });

  describe('getById / getByMonthYear', () => {
    it('retrieves meeting by ID', () => {
      const created = seedMeeting({ month_year: '2026-06' });
      const found = meetings.getById(created.id);
      assert.ok(found);
      assert.equal(found.id, created.id);
    });

    it('retrieves meeting by month_year', () => {
      seedMeeting({ month_year: '2026-09' });
      const found = meetings.getByMonthYear('2026-09');
      assert.ok(found);
      assert.equal(found.month_year, '2026-09');
    });

    it('returns null for nonexistent ID', () => {
      assert.equal(meetings.getById(99999), null);
    });

    it('returns null for nonexistent month_year', () => {
      assert.equal(meetings.getByMonthYear('1999-01'), null);
    });
  });

  describe('getCurrent', () => {
    it('returns the active meeting (reading/nominations/voting)', () => {
      seedMeeting({ month_year: '2026-05', status: 'results' });
      seedMeeting({ month_year: '2026-06', status: 'reading' });

      const current = meetings.getCurrent();
      assert.ok(current);
      assert.equal(current.month_year, '2026-06');
    });

    it('returns null when no active meeting', () => {
      seedMeeting({ month_year: '2026-05', status: 'results' });
      assert.equal(meetings.getCurrent(), null);
    });
  });

  describe('update', () => {
    it('updates meeting fields', () => {
      const meeting = seedMeeting({ month_year: '2026-06' });
      const updated = meetings.update(meeting.id, {
        month_year: '2026-06',
        meeting_time: '2026-06-20T19:00',
        location_text: 'New Venue',
      });
      assert.equal(updated.location_text, 'New Venue');
      assert.equal(updated.meeting_time, '2026-06-20T19:00');
    });
  });

  describe('nominees', () => {
    it('adds and retrieves nominees', () => {
      const meeting = seedMeeting({ status: 'nominations' });
      const book = seedBook();
      meetings.addNominee(meeting.id, book.id);

      const nominees = meetings.getNominees(meeting.id);
      assert.equal(nominees.length, 1);
      assert.equal(nominees[0].book_id, book.id);
    });

    it('removes a nominee and its nomination', () => {
      const meeting = seedMeeting({ status: 'nominations' });
      const book = seedBook();
      const user = seedUser();
      seedNominee(meeting.id, book.id, { userId: user.id, reason: 'test' });

      meetings.removeNominee(meeting.id, book.id);
      const nominees = meetings.getNominees(meeting.id);
      assert.equal(nominees.length, 0);
    });

    it('addNominee is idempotent (INSERT OR IGNORE)', () => {
      const meeting = seedMeeting({ status: 'nominations' });
      const book = seedBook();
      meetings.addNominee(meeting.id, book.id);
      meetings.addNominee(meeting.id, book.id); // second call should not error

      const nominees = meetings.getNominees(meeting.id);
      assert.equal(nominees.length, 1);
    });
  });

  describe('getStats', () => {
    it('counts books, members, and reviews', () => {
      const stats = meetings.getStats();
      assert.equal(typeof stats.totalBooks, 'number');
      assert.equal(typeof stats.totalMembers, 'number');
      assert.equal(typeof stats.totalReviews, 'number');
    });
  });

  describe('deleteById', () => {
    it('deletes meeting and all associated data', () => {
      const meeting = seedMeeting({ status: 'nominations' });
      const book = seedBook();
      seedNominee(meeting.id, book.id);

      meetings.deleteById(meeting.id);
      assert.equal(meetings.getById(meeting.id), null);

      const nominees = db.prepare('SELECT * FROM meeting_nominees WHERE meeting_id = ?').all(meeting.id);
      assert.equal(nominees.length, 0);
    });
  });
});
