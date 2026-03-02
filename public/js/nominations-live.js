/**
 * nominations-live.js — SSE client for real-time nominations updates.
 *
 * Connects to /api/meetings/:meetingId/nominations/stream and updates:
 * - Nominee list (full rebuild on each event)
 * - Nominee count
 * - Empty state visibility
 *
 * Reconnects with exponential backoff (1s → 30s max).
 */
(function () {
  'use strict';

  var config = window.__NOMINATIONS_CONFIG__;
  if (!config || !config.meetingId) return;

  var grid     = document.getElementById('nominee-grid');
  var countEl  = document.getElementById('nominee-count');
  var emptyEl  = document.getElementById('nominee-empty');

  if (!grid) return;

  var baseDelay  = 1000;
  var maxDelay   = 30000;
  var delay      = baseDelay;
  var es         = null;
  var isFirst    = true;
  var knownIds   = new Set();

  // Seed known IDs from server-rendered nominees
  var initialCards = grid.querySelectorAll('.nominee-card');
  for (var i = 0; i < initialCards.length; i++) {
    knownIds.add(initialCards[i].dataset.bookId);
  }

  // ── Build a single nominee card ─────────────────────────────
  function buildCard(nom) {
    var card = document.createElement('div');
    card.className = 'nominee-card';
    card.dataset.bookId = String(nom.book_id);

    var coverHtml;
    if (nom.cover_url) {
      coverHtml = '<img src="' + escapeHtml(nom.cover_url) + '" alt="' + escapeHtml(nom.title) + ' cover" loading="lazy">';
    } else {
      coverHtml = '<div class="placeholder-cover placeholder-cover--sm"><span class="placeholder-cover__title">' + escapeHtml(nom.title) + '</span></div>';
    }

    var nominatorHtml = nom.nominator_name
      ? '<span class="nominee-card__nominator t-caption text-tertiary">Nominated by ' + escapeHtml(nom.nominator_name) + '</span>'
      : '';

    card.innerHTML =
      '<div class="book-cover book-cover--sm nominee-card__cover">' + coverHtml + '</div>' +
      '<div class="nominee-card__body">' +
        '<span class="nominee-card__title t-body-bold">' + escapeHtml(nom.title) + '</span>' +
        '<span class="nominee-card__author t-caption text-secondary">' + escapeHtml(nom.author) + '</span>' +
        nominatorHtml +
      '</div>';

    return card;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Render full nominee list ────────────────────────────────
  function renderNominees(nominees) {
    var shouldAnimate = !isFirst;
    isFirst = false;

    // Track new book IDs for entrance animation
    var newBookIds = new Set();
    if (shouldAnimate) {
      for (var n = 0; n < nominees.length; n++) {
        if (!knownIds.has(String(nominees[n].book_id))) {
          newBookIds.add(String(nominees[n].book_id));
        }
      }
    }

    // Update known IDs
    knownIds.clear();
    for (var k = 0; k < nominees.length; k++) {
      knownIds.add(String(nominees[k].book_id));
    }

    // Clear existing content
    grid.innerHTML = '';

    if (nominees.length === 0) {
      var empty = document.createElement('p');
      empty.className = 't-body text-secondary nominations-page__empty';
      empty.id = 'nominee-empty';
      empty.textContent = 'No nominations yet \u2014 be the first!';
      grid.appendChild(empty);
    } else {
      for (var i = 0; i < nominees.length; i++) {
        var card = buildCard(nominees[i]);
        if (shouldAnimate && newBookIds.has(String(nominees[i].book_id))) {
          card.classList.add('nominee-card--entering');
        }
        grid.appendChild(card);
      }
    }

    // Update count
    if (countEl) {
      countEl.textContent = String(nominees.length);
    }
  }

  // ── SSE connection ──────────────────────────────────────────
  function connect() {
    es = new EventSource('/api/meetings/' + config.meetingId + '/nominations/stream');

    es.onopen = function () {
      delay = baseDelay;
    };

    es.addEventListener('nominees', function (e) {
      try {
        var nominees = JSON.parse(e.data);
        renderNominees(nominees);
      } catch (err) {
        // Ignore malformed messages
      }
    });

    es.onerror = function () {
      es.close();
      setTimeout(connect, delay);
      delay = Math.min(delay * 2, maxDelay);
    };
  }

  connect();
})();
