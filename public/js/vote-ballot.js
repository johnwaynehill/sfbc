/**
 * vote-ballot.js — Progressive enhancement for the ranked-choice ballot.
 *
 * 1. Desktop drag & drop reordering
 * 2. Mobile touch reordering (with floating ghost)
 * 3. Rank number updates after each reorder
 * 4. Hidden ranking input kept in sync with DOM order
 * 5. Fetch-based form submission with redirect to results
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

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function getCards() {
    return Array.from(list.querySelectorAll('.ballot-card'));
  }

  function updateRanks() {
    var cards = getCards();
    cards.forEach(function (card, i) {
      card.querySelector('.ballot-card__rank').textContent = i + 1;

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
  // Mobile touch reordering
  // -----------------------------------------------------------------------

  var touchCard = null;
  var ghost = null;
  var touchStartY = 0;
  var touchOffsetY = 0;

  list.addEventListener('touchstart', function (e) {
    var handle = e.target.closest('.ballot-card__handle');
    if (!handle) return;

    var card = handle.closest('.ballot-card');
    if (!card) return;

    touchCard = card;
    var rect = card.getBoundingClientRect();
    touchStartY = e.touches[0].clientY;
    touchOffsetY = touchStartY - rect.top;

    // Create floating ghost clone
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
  }, { passive: true });

  list.addEventListener('touchmove', function (e) {
    if (!touchCard || !ghost) return;
    e.preventDefault();

    var y = e.touches[0].clientY;
    ghost.style.top = (y - touchOffsetY) + 'px';

    var target = getCardFromPoint(e.touches[0].clientX, y, touchCard);
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
  // Up/down arrow buttons
  // -----------------------------------------------------------------------

  list.addEventListener('click', function (e) {
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
        window.location.href = data.redirect || ('/results/' + meetingId);
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

  // Initial sync
  syncHiddenInput();
})();
