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

  // ── Color hash for placeholder covers ──────────────────────
  function colorHash(str) {
    if (!str) return 0;
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xFFFFFFFF;
    }
    return Math.abs(hash) % 360;
  }

  // ── Build a single nominee card ─────────────────────────────
  function buildCard(nom) {
    var card = document.createElement('div');
    card.className = 'nominee-card';
    card.dataset.bookId = String(nom.book_id);

    var coverImgHtml;
    if (nom.cover_url) {
      coverImgHtml = '<img src="' + escapeHtml(nom.cover_url) + '" alt="' + escapeHtml(nom.title) + ' cover" loading="lazy">';
    } else {
      var hue = colorHash(nom.title);
      var initial = nom.title ? nom.title.charAt(0).toUpperCase() : '?';
      coverImgHtml = '<div class="placeholder-cover placeholder-cover--sm" style="--ph-hue: ' + hue + '"><span class="placeholder-cover__initial">' + escapeHtml(initial) + '</span><span class="placeholder-cover__title">' + escapeHtml(nom.title) + '</span></div>';
    }

    var detailsCoverHtml;
    if (nom.cover_url) {
      detailsCoverHtml = '<img src="' + escapeHtml(nom.cover_url) + '" alt="' + escapeHtml(nom.title) + ' cover" loading="lazy">';
    } else {
      var hue2 = colorHash(nom.title);
      var init2 = nom.title ? nom.title.charAt(0).toUpperCase() : '?';
      detailsCoverHtml = '<div class="placeholder-cover placeholder-cover--md" style="--ph-hue: ' + hue2 + '"><span class="placeholder-cover__initial">' + escapeHtml(init2) + '</span><span class="placeholder-cover__title">' + escapeHtml(nom.title) + '</span></div>';
    }

    var nominatorHtml = nom.nominator_name
      ? '<span class="nominee-card__nominator t-caption text-tertiary">Nominated by ' + escapeHtml(nom.nominator_name) + '</span>'
      : '';

    var metaParts = [];
    if (nom.publication_year) metaParts.push(escapeHtml(String(nom.publication_year)));
    if (nom.page_count) metaParts.push(escapeHtml(String(nom.page_count)) + ' pages');
    if (nom.publisher) metaParts.push(escapeHtml(nom.publisher));
    if (nom.language && nom.language !== 'en') metaParts.push(escapeHtml(nom.language.toUpperCase()));

    var subjectList = [];
    if (nom.subjects) {
      try { subjectList = JSON.parse(nom.subjects); } catch (e) { subjectList = []; }
    }

    var tagsHtml = '';
    if (subjectList.length > 0) {
      tagsHtml = '<div class="book-details__tags">';
      for (var t = 0; t < Math.min(subjectList.length, 4); t++) {
        tagsHtml += '<span class="book-tag">' + escapeHtml(subjectList[t]) + '</span>';
      }
      tagsHtml += '</div>';
    }

    var descHtml = nom.description
      ? '<div class="book-details__section"><p class="book-details__description t-body">' + escapeHtml(nom.description) + '</p></div>'
      : '';

    var nominationSectionHtml = '';
    if (nom.reason || nom.nominator_name) {
      nominationSectionHtml = '<div class="book-details__section book-details__nomination">';
      if (nom.nominator_name) {
        nominationSectionHtml += '<p class="t-label">Nominated by ' + escapeHtml(nom.nominator_name) + '</p>';
      }
      if (nom.reason) {
        nominationSectionHtml += '<p class="book-details__reason t-body">&ldquo;' + escapeHtml(nom.reason) + '&rdquo;</p>';
      }
      nominationSectionHtml += '</div>';
    }

    var bookLinkHtml = '';
    if (nom.author_slug && nom.title_slug) {
      bookLinkHtml = '<div class="book-details__footer"><a href="/books/' + escapeHtml(nom.author_slug) + '/' + escapeHtml(nom.title_slug) + '" target="_blank" rel="noopener" class="book-details__link">View Details <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></div>';
    }

    card.innerHTML =
      '<button type="button" class="book-cover book-cover--sm nominee-card__cover ballot-card__cover-btn" aria-label="View details for ' + escapeHtml(nom.title) + '">' + coverImgHtml + '</button>' +
      '<div class="nominee-card__body">' +
        '<span class="nominee-card__title t-body-bold">' + escapeHtml(nom.title) + '</span>' +
        '<span class="nominee-card__author t-caption text-secondary">' + escapeHtml(nom.author) + '</span>' +
        nominatorHtml +
        '<button type="button" class="ballot-card__details-link t-caption" data-book-id="' + escapeHtml(String(nom.book_id)) + '">View <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></button>' +
        '<template class="ballot-card__details-template">' +
          '<div class="book-details">' +
            '<div class="book-details__header">' +
              '<div class="book-cover book-cover--md book-details__cover">' + detailsCoverHtml + '</div>' +
              '<div class="book-details__meta">' +
                '<h2 class="book-details__title t-display">' + escapeHtml(nom.title) + '</h2>' +
                '<p class="book-details__author t-author">by ' + escapeHtml(nom.author) + '</p>' +
                (metaParts.length > 0 ? '<p class="book-details__inline-meta t-caption text-secondary">' + metaParts.join(' &middot; ') + '</p>' : '') +
                tagsHtml +
              '</div>' +
            '</div>' +
            descHtml +
            nominationSectionHtml +
            bookLinkHtml +
          '</div>' +
        '</template>' +
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

  // ── Book details dialog ──────────────────────────────────────
  var detailsDialog = document.getElementById('book-details-dialog');
  var detailsBody   = document.getElementById('book-details-dialog-body');

  function openDetailsDialog(card) {
    if (!detailsDialog || !detailsBody) return;
    var template = card.querySelector('.ballot-card__details-template');
    if (!template) return;
    detailsBody.innerHTML = '';
    detailsBody.appendChild(template.content.cloneNode(true));
    if (typeof detailsDialog.showModal === 'function') {
      detailsDialog.showModal();
    } else {
      detailsDialog.setAttribute('open', '');
    }
    document.body.classList.add('has-open-dialog');
  }

  function closeDetailsDialog() {
    if (!detailsDialog) return;
    detailsDialog.classList.add('is-closing');
    setTimeout(function () {
      detailsDialog.classList.remove('is-closing');
      if (typeof detailsDialog.close === 'function') {
        detailsDialog.close();
      } else {
        detailsDialog.removeAttribute('open');
      }
      detailsBody.innerHTML = '';
      document.body.classList.remove('has-open-dialog');
    }, 180);
  }

  if (detailsDialog) {
    detailsDialog.addEventListener('click', function (e) {
      if (e.target === detailsDialog) closeDetailsDialog();
    });
    detailsDialog.addEventListener('cancel', function (e) {
      e.preventDefault();
      closeDetailsDialog();
    });
    var closeBtn = detailsDialog.querySelector('.book-details-dialog__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDetailsDialog);
    }
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.ballot-card__details-link, .ballot-card__cover-btn');
    if (!trigger) return;
    var card = trigger.closest('.nominee-card');
    if (card) openDetailsDialog(card);
  });
})();
