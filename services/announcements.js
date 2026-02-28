'use strict';

const db = require('../db');

/* ------------------------------------------------------------------ */
/*  Prepared statements                                                */
/* ------------------------------------------------------------------ */

const stmts = {
  /** Active announcements (max 3, non-expired, newest first). */
  getActive: db.prepare(`
    SELECT id, type, title, body, created_at
    FROM announcements
    WHERE is_active = 1
      AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY created_at DESC
    LIMIT 3
  `),

  /** All announcements for admin, newest first. */
  getAll: db.prepare(`
    SELECT a.id, a.type, a.title, a.body, a.is_active, a.expires_at, a.created_at,
           u.display_name AS created_by_name
    FROM announcements a
    LEFT JOIN users u ON u.id = a.created_by
    ORDER BY a.created_at DESC
  `),

  /** Create a new announcement. */
  create: db.prepare(`
    INSERT INTO announcements (type, title, body, created_by, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `),

  /** Deactivate (soft-delete). */
  deactivate: db.prepare(`
    UPDATE announcements SET is_active = 0 WHERE id = ?
  `),

  /** Reactivate. */
  activate: db.prepare(`
    UPDATE announcements SET is_active = 1 WHERE id = ?
  `),

  /** Hard delete. */
  deleteById: db.prepare(`
    DELETE FROM announcements WHERE id = ?
  `),

  /** Get by ID. */
  getById: db.prepare(`
    SELECT * FROM announcements WHERE id = ?
  `),
};

/* ------------------------------------------------------------------ */
/*  Exported functions                                                  */
/* ------------------------------------------------------------------ */

function getActive() {
  return stmts.getActive.all();
}

function getAll() {
  return stmts.getAll.all();
}

function getById(id) {
  return stmts.getById.get(id);
}

function create({ type, title, body, createdBy, expiresAt }) {
  const info = stmts.create.run(
    type || 'info',
    title,
    body || null,
    createdBy || null,
    expiresAt || null,
  );
  return { id: Number(info.lastInsertRowid) };
}

function deactivate(id) {
  return stmts.deactivate.run(id);
}

function activate(id) {
  return stmts.activate.run(id);
}

function deleteById(id) {
  return stmts.deleteById.run(id);
}

module.exports = { getActive, getAll, getById, create, deactivate, activate, deleteById };
