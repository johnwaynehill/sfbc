'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { db, freshDb, seedUser, seedBook, seedMeeting } = require('./setup');

let picks;

describe('monthly-picks service', () => {
  beforeEach(() => {
    freshDb();
    picks = require('../services/monthly-picks');
  });

  describe('create / getById / getByMonthYear', () => {
    it('creates a pick and retrieves it by ID', () => {
      const book = seedBook({ title: 'Pick Book', author: 'Author' });
      const pick = picks.create(book.id, '2026-06');
      assert.ok(pick);
      assert.equal(pick.book_id, book.id);
      assert.equal(pick.month_year, '2026-06');
      assert.equal(pick.status, 'upcoming');

      const found = picks.getById(pick.id);
      assert.equal(found.id, pick.id);
    });

    it('retrieves by month_year', () => {
      const book = seedBook();
      picks.create(book.id, '2026-09');
      const found = picks.getByMonthYear('2026-09');
      assert.ok(found);
      assert.equal(found.month_year, '2026-09');
    });

    it('returns null for nonexistent month', () => {
      assert.equal(picks.getByMonthYear('1999-01'), null);
    });
  });

  describe('getHero', () => {
    it('returns the reading pick as hero', () => {
      const book = seedBook({ title: 'Hero Book', author: 'Author' });
      picks.create(book.id, '2026-06', 'reading');

      const hero = picks.getHero();
      assert.ok(hero);
      assert.equal(hero.title, 'Hero Book');
    });

    it('falls back to most recent results pick if none reading', () => {
      const book = seedBook({ title: 'Past Book', author: 'Author' });
      picks.create(book.id, '2026-05', 'results');

      const hero = picks.getHero();
      assert.ok(hero);
      assert.equal(hero.title, 'Past Book');
    });

    it('returns null with no picks', () => {
      assert.equal(picks.getHero(), null);
    });
  });

  describe('getRecentPicks', () => {
    it('returns completed picks', () => {
      const book1 = seedBook({ title: 'Book 1', author: 'Author 1' });
      const book2 = seedBook({ title: 'Book 2', author: 'Author 2' });
      picks.create(book1.id, '2026-04', 'results');
      picks.create(book2.id, '2026-05', 'results');

      const recent = picks.getRecentPicks(10);
      assert.equal(recent.length, 2);
    });

    it('respects limit', () => {
      const book1 = seedBook({ title: 'B1', author: 'A1' });
      const book2 = seedBook({ title: 'B2', author: 'A2' });
      const book3 = seedBook({ title: 'B3', author: 'A3' });
      picks.create(book1.id, '2026-01', 'results');
      picks.create(book2.id, '2026-02', 'results');
      picks.create(book3.id, '2026-03', 'results');

      const recent = picks.getRecentPicks(2);
      assert.equal(recent.length, 2);
    });

    it('excludes specified pick', () => {
      const book1 = seedBook({ title: 'B1', author: 'A1' });
      const book2 = seedBook({ title: 'B2', author: 'A2' });
      const p1 = picks.create(book1.id, '2026-01', 'results');
      picks.create(book2.id, '2026-02', 'results');

      const recent = picks.getRecentPicks(10, p1.id);
      assert.equal(recent.length, 1);
      assert.equal(recent[0].title, 'B2');
    });
  });

  describe('getAdjacentPicks', () => {
    it('returns prev and next picks', () => {
      const b1 = seedBook({ title: 'B1', author: 'A1' });
      const b2 = seedBook({ title: 'B2', author: 'A2' });
      const b3 = seedBook({ title: 'B3', author: 'A3' });
      picks.create(b1.id, '2026-01', 'results');
      picks.create(b2.id, '2026-02', 'results');
      picks.create(b3.id, '2026-03', 'results');

      const adj = picks.getAdjacentPicks('2026-02');
      assert.ok(adj.prev);
      assert.equal(adj.prev.title, 'B1');
      assert.ok(adj.next);
      assert.equal(adj.next.title, 'B3');
    });

    it('returns null for prev/next at edges', () => {
      const b1 = seedBook({ title: 'Only', author: 'Author' });
      picks.create(b1.id, '2026-06', 'results');

      const adj = picks.getAdjacentPicks('2026-06');
      assert.equal(adj.prev, null);
      assert.equal(adj.next, null);
    });

    it('returns both null for null input', () => {
      const adj = picks.getAdjacentPicks(null);
      assert.equal(adj.prev, null);
      assert.equal(adj.next, null);
    });
  });

  describe('events', () => {
    it('creates, retrieves, updates, and deletes events', () => {
      const book = seedBook();
      const pick = picks.create(book.id, '2026-06', 'reading');

      // Create
      const event = picks.createEvent(pick.id, {
        meeting_time: '2026-06-15T18:30',
        location_text: 'Main Library',
        meetup_event_url: 'https://meetup.com/123',
      });
      assert.ok(event);
      assert.equal(event.location_text, 'Main Library');

      // Retrieve
      const events = picks.getEvents(pick.id);
      assert.equal(events.length, 1);

      const first = picks.getFirstEvent(pick.id);
      assert.ok(first);
      assert.equal(first.location_text, 'Main Library');

      // Update
      const updated = picks.updateEvent(pick.id, event.id, {
        meeting_time: '2026-06-20T19:00',
        location_text: 'New Venue',
      });
      assert.ok(updated);
      assert.equal(updated.location_text, 'New Venue');

      // Delete
      const deleted = picks.deleteEvent(pick.id, event.id);
      assert.equal(deleted, true);
      assert.equal(picks.getEvents(pick.id).length, 0);
    });

    it('updateEvent returns null for wrong pick ownership', () => {
      const book1 = seedBook({ title: 'B1', author: 'A1' });
      const book2 = seedBook({ title: 'B2', author: 'A2' });
      const pick1 = picks.create(book1.id, '2026-06', 'reading');
      const pick2 = picks.create(book2.id, '2026-07', 'reading');

      const event = picks.createEvent(pick1.id, { location_text: 'Spot' });
      const result = picks.updateEvent(pick2.id, event.id, { location_text: 'Hack' });
      assert.equal(result, null);
    });

    it('deleteEvent returns false for wrong pick ownership', () => {
      const book1 = seedBook({ title: 'B1', author: 'A1' });
      const book2 = seedBook({ title: 'B2', author: 'A2' });
      const pick1 = picks.create(book1.id, '2026-06', 'reading');
      const pick2 = picks.create(book2.id, '2026-07', 'reading');

      const event = picks.createEvent(pick1.id, { location_text: 'Spot' });
      assert.equal(picks.deleteEvent(pick2.id, event.id), false);
    });
  });

  describe('countCompleted', () => {
    it('counts only results-status picks', () => {
      const b1 = seedBook({ title: 'B1', author: 'A1' });
      const b2 = seedBook({ title: 'B2', author: 'A2' });
      const b3 = seedBook({ title: 'B3', author: 'A3' });
      picks.create(b1.id, '2026-01', 'results');
      picks.create(b2.id, '2026-02', 'results');
      picks.create(b3.id, '2026-03', 'reading');

      assert.equal(picks.countCompleted(), 2);
    });
  });
});
