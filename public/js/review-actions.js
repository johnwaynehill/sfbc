(function () {
  'use strict';

  var reviewList = document.getElementById('reviewList');
  if (!reviewList) return;

  // ── Delete review ─────────────────────────────────────────
  reviewList.addEventListener('click', async function (e) {
    var btn = e.target.closest('.review-card__delete');
    if (!btn) return;

    if (!await showConfirm('Delete your review? This cannot be undone.', { danger: true })) return;

    var bookId = btn.getAttribute('data-book-id');

    try {
      var res = await fetch('/api/books/' + bookId + '/reviews', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        // Remove the review card from the DOM
        var card = btn.closest('.review-card');
        if (card) card.remove();

        // If no reviews remain, show empty state
        var remaining = reviewList.querySelectorAll('.review-card');
        if (remaining.length === 0) {
          reviewList.innerHTML = '<div class="empty-state"><p class="empty-state__message">No reviews yet.</p></div>';
        }

        // Update "Edit My Review" button to "Write a Review"
        var editBtn = document.querySelector('.reviews-header__actions .btn--ghost');
        if (editBtn) {
          editBtn.className = editBtn.className.replace('btn--ghost', 'btn--primary');
          editBtn.textContent = 'Write a Review';
        }
      } else {
        var data = await res.json();
        showAlert(data.error || 'Failed to delete review.');
      }
    } catch (_) {
      showAlert('Network error. Please try again.');
    }
  });

  // ── Sort reviews ──────────────────────────────────────────
  var sortDropdown = document.getElementById('reviewSortDropdown');
  var sortBtn = document.getElementById('reviewSortBtn');
  var sortMenu = document.getElementById('reviewSortMenu');

  if (!sortDropdown || !sortBtn || !sortMenu) return;

  function openMenu() {
    sortDropdown.classList.add('is-open');
    sortBtn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    sortDropdown.classList.remove('is-open');
    sortBtn.setAttribute('aria-expanded', 'false');
  }

  sortBtn.addEventListener('click', function () {
    if (sortDropdown.classList.contains('is-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  sortMenu.addEventListener('click', function (e) {
    var item = e.target.closest('.sort-dropdown__item');
    if (!item) return;

    var mode = item.getAttribute('data-sort');

    // Update selected state
    var items = sortMenu.querySelectorAll('.sort-dropdown__item');
    items.forEach(function (el) {
      el.classList.remove('is-selected');
      el.setAttribute('aria-selected', 'false');
    });
    item.classList.add('is-selected');
    item.setAttribute('aria-selected', 'true');

    closeMenu();
    sortReviews(mode);
  });

  document.addEventListener('click', function (e) {
    if (!sortDropdown.contains(e.target)) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  function sortReviews(mode) {
    var cards = Array.prototype.slice.call(reviewList.querySelectorAll('.review-card'));

    cards.sort(function (a, b) {
      var da, db, wa, wb;
      switch (mode) {
        case 'oldest':
          da = a.getAttribute('data-date') || '';
          db = b.getAttribute('data-date') || '';
          return da.localeCompare(db);
        case 'highest':
          wa = parseFloat(a.getAttribute('data-weight')) || 0;
          wb = parseFloat(b.getAttribute('data-weight')) || 0;
          return wb - wa;
        case 'lowest':
          wa = parseFloat(a.getAttribute('data-weight')) || 0;
          wb = parseFloat(b.getAttribute('data-weight')) || 0;
          return wa - wb;
        default: // newest
          da = a.getAttribute('data-date') || '';
          db = b.getAttribute('data-date') || '';
          return db.localeCompare(da);
      }
    });

    cards.forEach(function (card) {
      reviewList.appendChild(card);
    });
  }

  // ── Grade axis tooltips (mobile tap) ─────────────────────
  var gradeAxis = document.querySelector('.grade-dist__axis');
  if (gradeAxis) {
    gradeAxis.addEventListener('click', function (e) {
      var span = e.target.closest('span.active');
      if (!span) return;
      var wasActive = span.classList.contains('is-tapped');
      // Clear any other tapped
      var all = gradeAxis.querySelectorAll('span.is-tapped');
      for (var i = 0; i < all.length; i++) all[i].classList.remove('is-tapped');
      if (!wasActive) span.classList.add('is-tapped');
    });
    // Dismiss on outside tap
    document.addEventListener('click', function (e) {
      if (!gradeAxis.contains(e.target)) {
        var tapped = gradeAxis.querySelectorAll('span.is-tapped');
        for (var i = 0; i < tapped.length; i++) tapped[i].classList.remove('is-tapped');
      }
    });
  }

  // ── Spoiler filter ──────────────────────────────────────
  var spoilerToggle = document.getElementById('spoilerToggle');
  var spoilerIcon = spoilerToggle ? spoilerToggle.querySelector('.spoiler-toggle__icon') : null;
  var spoilerText = spoilerToggle ? spoilerToggle.querySelector('.spoiler-toggle__text') : null;

  // Eye-off SVG (spoilers hidden — default)
  var EYE_OFF = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  // Eye SVG (spoilers showing)
  var EYE_ON = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';

  if (spoilerToggle) {
    function updateSpoilerUI(isShowing) {
      spoilerToggle.setAttribute('aria-pressed', String(isShowing));
      spoilerToggle.classList.toggle('is-active', isShowing);
      if (spoilerText) spoilerText.textContent = isShowing ? 'Hide spoilers' : 'Show spoilers';
      if (spoilerIcon) spoilerIcon.innerHTML = isShowing ? EYE_ON : EYE_OFF;
    }

    // Restore from localStorage
    var showSpoilers = localStorage.getItem('showSpoilers') === 'true';
    if (showSpoilers) {
      reviewList.classList.add('show-spoilers');
      updateSpoilerUI(true);
    }

    spoilerToggle.addEventListener('click', function () {
      var isShowing = reviewList.classList.toggle('show-spoilers');
      updateSpoilerUI(isShowing);
      localStorage.setItem('showSpoilers', String(isShowing));
    });
  }
})();
