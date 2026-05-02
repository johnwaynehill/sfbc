/**
 * vote-ballot.js — Progressive enhancement for the ranked-choice ballot.
 *
 * 1. Desktop drag & drop reordering (HTML5 native)
 * 2. Mobile touch reordering via long-press anywhere on a card (~250ms hold)
 *    with haptic feedback and a floating ghost that follows the finger
 * 3. Up/down arrow buttons as accessibility fallback (keyboard, screen
 *    reader, motor-impairment users)
 * 4. Rank number updates after each reorder
 * 5. Hidden ranking input kept in sync with DOM order
 * 6. Fetch-based form submission with redirect to results
 */
(function () {
  'use strict';

  var form = document.getElementById('vote-form');
  if (!form) return;

  var list      = document.getElementById('ballot-list');
  var rankInput = document.getElementById('ranking-input');
  var submitBtn = document.getElementById('vote-submit');
  var messageEl = document.getElementById('vote-message');
  var meetingId = form.dataset.meetingId;
  var meetingSlug = form.dataset.meetingSlug;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // -----------------------------------------------------------------------
  // Haptic helper — short tactile blip on supported devices.
  // Wrap in a try/catch since some browsers throw on unsupported patterns.
  // -----------------------------------------------------------------------
  function haptic(ms) {
    if (!('vibrate' in navigator)) return;
    try { navigator.vibrate(ms); } catch (_) { /* no-op */ }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function getCards() {
    return Array.from(list.querySelectorAll('.ballot-card'));
  }

  function updateRanks() {
    var cards = getCards();
    cards.forEach(function (card, i) {
      var rankEl = card.querySelector('.ballot-card__rank');
      if (rankEl) rankEl.textContent = i + 1;

      // Update up/down button disabled states
      var upBtn = card.querySelector('.ballot-card__move--up');
      var downBtn = card.querySelector('.ballot-card__move--down');
      if (upBtn) upBtn.disabled = (i === 0);
      if (downBtn) downBtn.disabled = (i === cards.length - 1);
    });
  }

  function syncHiddenInput() {
    rankInput.value = getCards().map(function (card) {
      return card.dataset.bookId;
    }).join(',');
  }

  function getCardFromPoint(x, y, exclude) {
    var cards = getCards();
    for (var i = 0; i < cards.length; i++) {
      if (cards[i] === exclude) continue;
      var rect = cards[i].getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        // Insert before or after based on midpoint
        var mid = rect.top + rect.height / 2;
        return { card: cards[i], before: y < mid };
      }
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Desktop drag & drop
  // -----------------------------------------------------------------------

  var dragCard = null;

  list.addEventListener('dragstart', function (e) {
    var card = e.target.closest('.ballot-card');
    if (!card) return;
    dragCard = card;
    // Slight delay so the browser captures the card appearance first
    setTimeout(function () {
      card.classList.add('ballot-card--dragging');
    }, 0);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.bookId);
  });

  list.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!dragCard) return;

    var target = getCardFromPoint(e.clientX, e.clientY, dragCard);
    if (target) {
      if (target.before) {
        list.insertBefore(dragCard, target.card);
      } else {
        list.insertBefore(dragCard, target.card.nextSibling);
      }
      updateRanks();
    }
  });

  list.addEventListener('dragend', function () {
    if (dragCard) {
      dragCard.classList.remove('ballot-card--dragging');
      dragCard = null;
      updateRanks();
      syncHiddenInput();
    }
  });

  // -----------------------------------------------------------------------
  // Touch reordering — long-press (~250ms still) anywhere on a card to enter
  // drag mode. Lets us avoid the "touch-anywhere = drag-anywhere" conflict
  // that broke iPhone 13 (taps and scroll attempts hijacked into drags),
  // while still giving members a real D&D experience without arrow tedium.
  // -----------------------------------------------------------------------
  var LONG_PRESS_MS = 250;
  var MOVE_CANCEL_PX = 10;

  var touchCard = null;     // the card currently being dragged
  var pressTimer = null;    // long-press timer (null when inactive)
  var pressCard = null;     // card the user is pressing (pre-drag-mode)
  var pressStartX = 0;
  var pressStartY = 0;
  var ghost = null;
  var touchOffsetY = 0;

  function clearPressTimer() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    pressCard = null;
  }

  function activateDrag(card, startX, startY) {
    touchCard = card;
    var rect = card.getBoundingClientRect();
    touchOffsetY = startY - rect.top;

    // Floating ghost that follows the finger
    ghost = card.cloneNode(true);
    ghost.classList.add('ballot-card--ghost');
    ghost.style.width = rect.width + 'px';
    ghost.style.position = 'fixed';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.zIndex = '1000';
    ghost.style.pointerEvents = 'none';
    document.body.appendChild(ghost);

    card.classList.add('ballot-card--dragging');
    haptic(15);  // short blip — drag mode confirmed
  }

  list.addEventListener('touchstart', function (e) {
    // Don't intercept taps on interactive children (arrows, details link)
    if (e.target.closest('.ballot-card__move, .ballot-card__details-link')) {
      return;
    }
    var card = e.target.closest('.ballot-card');
    if (!card) return;

    pressCard = card;
    pressStartX = e.touches[0].clientX;
    pressStartY = e.touches[0].clientY;

    pressTimer = setTimeout(function () {
      pressTimer = null;
      activateDrag(pressCard, pressStartX, pressStartY);
    }, LONG_PRESS_MS);
  }, { passive: true });

  list.addEventListener('touchmove', function (e) {
    var t = e.touches[0];

    // Pre-drag-mode: cancel the long-press if the finger moves significantly
    // (the user is scrolling or sliding, not pressing-and-holding).
    if (pressTimer) {
      var dx = t.clientX - pressStartX;
      var dy = t.clientY - pressStartY;
      if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
        clearPressTimer();
      }
      return;
    }

    // Drag mode: take over scroll, follow the finger, reorder cards
    if (!touchCard || !ghost) return;
    e.preventDefault();

    var y = t.clientY;
    ghost.style.top = (y - touchOffsetY) + 'px';

    var target = getCardFromPoint(t.clientX, y, touchCard);
    if (target) {
      if (target.before) {
        list.insertBefore(touchCard, target.card);
      } else {
        list.insertBefore(touchCard, target.card.nextSibling);
      }
      updateRanks();
    }
  }, { passive: false });

  function endTouch() {
    clearPressTimer();
    if (touchCard) {
      touchCard.classList.remove('ballot-card--dragging');
      touchCard = null;
    }
    if (ghost) {
      ghost.remove();
      ghost = null;
    }
    updateRanks();
    syncHiddenInput();
  }

  list.addEventListener('touchend', endTouch);
  list.addEventListener('touchcancel', endTouch);

  // -----------------------------------------------------------------------
  // Book details dialog (bottom sheet on mobile, modal on desktop)
  // -----------------------------------------------------------------------

  var detailsDialog = document.getElementById('book-details-dialog');
  var detailsBody = document.getElementById('book-details-dialog-body');

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
    // Close on backdrop click
    detailsDialog.addEventListener('click', function (e) {
      if (e.target === detailsDialog) closeDetailsDialog();
    });
    // Close on Escape (native cancel event)
    detailsDialog.addEventListener('cancel', function (e) {
      e.preventDefault();
      closeDetailsDialog();
    });
    // Close button
    var closeBtn = detailsDialog.querySelector('.book-details-dialog__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDetailsDialog);
    }
  }

  // -----------------------------------------------------------------------
  // Card click delegation: details link + up/down arrows
  // -----------------------------------------------------------------------

  list.addEventListener('click', function (e) {
    var detailsLink = e.target.closest('.ballot-card__details-link');
    if (detailsLink) {
      var card = detailsLink.closest('.ballot-card');
      if (card) openDetailsDialog(card);
      return;
    }

    // -----------------------------------------------------------------------
    // Up/down arrow buttons
    // -----------------------------------------------------------------------
    var btn = e.target.closest('.ballot-card__move');
    if (!btn || btn.disabled) return;

    var card = btn.closest('.ballot-card');
    if (!card) return;

    var isUp = btn.classList.contains('ballot-card__move--up');

    if (isUp && card.previousElementSibling) {
      list.insertBefore(card, card.previousElementSibling);
    } else if (!isUp && card.nextElementSibling) {
      list.insertBefore(card.nextElementSibling, card);
    }

    updateRanks();
    syncHiddenInput();

    // Keep focus on the button that was clicked (it moved with the card)
    btn.focus();
  });

  // -----------------------------------------------------------------------
  // Fetch-based form submission
  // -----------------------------------------------------------------------
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var ranking = getCards().map(function (card) {
      return parseInt(card.dataset.bookId, 10);
    });

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting\u2026';

    try {
      var res = await fetch('/api/meetings/' + meetingId + '/votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ ranking: ranking }),
      });

      var data = await res.json();

      if (res.ok && data.success) {
        // Redirect to results page
        window.location.href = data.redirect || ('/results/' + meetingSlug);
        return;
      }

      showError(data.error || 'Something went wrong.');
    } catch (err) {
      showError('Network error. Please try again.');
    }
  });

  function showError(msg) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Vote';
    messageEl.hidden = false;
    messageEl.className = 'nom-message nom-message--error';
    messageEl.textContent = msg;
  }

  // On touch-primary devices, remove the HTML5 draggable attribute so native
  // drag doesn't fight with our long-press touch handler. Desktop with mouse
  // keeps native drag; touch users get long-press + ghost.
  if (window.matchMedia('(pointer: coarse)').matches) {
    getCards().forEach(function (card) {
      card.removeAttribute('draggable');
    });
  }

  // Initial sync
  syncHiddenInput();
})();
