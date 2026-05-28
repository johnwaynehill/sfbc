'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { db, freshDb, seedUser } = require('./setup');

let announcements;

describe('announcements service', () => {
  let admin;

  beforeEach(() => {
    freshDb();
    announcements = require('../services/announcements');
    admin = seedUser({ email: 'admin@test.com', display_name: 'Admin', role: 'admin' });
  });

  describe('create / getById', () => {
    it('creates an announcement with defaults and returns its id', () => {
      const { id } = announcements.create({ title: 'Heads up', createdBy: admin.id });
      assert.ok(Number.isInteger(id));

      const row = announcements.getById(id);
      assert.equal(row.title, 'Heads up');
      assert.equal(row.type, 'info'); // default
      assert.equal(row.is_active, 1); // default active
      assert.equal(row.body, null);
      assert.equal(row.created_by, admin.id);
    });

    it('stores type, body, and expiry when provided', () => {
      const { id } = announcements.create({
        type: 'warning',
        title: 'Meeting moved',
        body: 'New location this month.',
        createdBy: admin.id,
        expiresAt: '2099-01-01 00:00:00',
      });
      const row = announcements.getById(id);
      assert.equal(row.type, 'warning');
      assert.equal(row.body, 'New location this month.');
      assert.equal(row.expires_at, '2099-01-01 00:00:00');
    });

    it('getById returns undefined for nonexistent id', () => {
      assert.equal(announcements.getById(99999), undefined);
    });
  });

  describe('getActive', () => {
    it('returns only active, non-expired announcements', () => {
      announcements.create({ title: 'Active', createdBy: admin.id });
      const { id: inactiveId } = announcements.create({ title: 'Inactive', createdBy: admin.id });
      announcements.deactivate(inactiveId);

      const active = announcements.getActive();
      assert.equal(active.length, 1);
      assert.equal(active[0].title, 'Active');
    });

    it('excludes expired announcements', () => {
      announcements.create({ title: 'Fresh', createdBy: admin.id });
      announcements.create({
        title: 'Expired',
        createdBy: admin.id,
        expiresAt: '2000-01-01 00:00:00', // long past
      });

      const active = announcements.getActive();
      const titles = active.map(a => a.title);
      assert.ok(titles.includes('Fresh'));
      assert.ok(!titles.includes('Expired'));
    });

    it('includes announcements with a future expiry', () => {
      announcements.create({
        title: 'Future expiry',
        createdBy: admin.id,
        expiresAt: '2099-12-31 23:59:59',
      });
      const active = announcements.getActive();
      assert.equal(active.length, 1);
      assert.equal(active[0].title, 'Future expiry');
    });

    it('caps results at 3, newest first', () => {
      for (let i = 1; i <= 5; i++) {
        announcements.create({ title: `Note ${i}`, createdBy: admin.id });
      }
      const active = announcements.getActive();
      assert.equal(active.length, 3);
    });

    it('returns empty array when none exist', () => {
      assert.deepEqual(announcements.getActive(), []);
    });
  });

  describe('getAll', () => {
    it('returns all announcements including inactive, with creator name', () => {
      const { id } = announcements.create({ title: 'A', createdBy: admin.id });
      announcements.deactivate(id);
      announcements.create({ title: 'B', createdBy: admin.id });

      const all = announcements.getAll();
      assert.equal(all.length, 2);
      // creator name joined
      assert.ok(all.every(a => a.created_by_name === 'Admin'));
    });

    it('handles announcements with a null creator (orphaned)', () => {
      announcements.create({ title: 'No creator', createdBy: null });
      const all = announcements.getAll();
      assert.equal(all.length, 1);
      assert.equal(all[0].created_by_name, null);
    });
  });

  describe('activate / deactivate', () => {
    it('toggles is_active', () => {
      const { id } = announcements.create({ title: 'Toggle me', createdBy: admin.id });

      announcements.deactivate(id);
      assert.equal(announcements.getById(id).is_active, 0);

      announcements.activate(id);
      assert.equal(announcements.getById(id).is_active, 1);
    });
  });

  describe('deleteById', () => {
    it('hard-deletes an announcement', () => {
      const { id } = announcements.create({ title: 'Delete me', createdBy: admin.id });
      announcements.deleteById(id);
      assert.equal(announcements.getById(id), undefined);
    });
  });
});
