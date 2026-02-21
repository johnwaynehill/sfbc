(function () {
  'use strict';

  var reviewList = document.getElementById('reviewList');
  if (!reviewList) return;

  // ── Delete review ─────────────────────────────────────────
  reviewList.addEventListener('click', function (e) {
    var btn = e.target.closest('.review-card__delete');
    if (!btn) return;

    if (!confirm('Delete your review? This cannot be undone.')) return;

    var bookId = btn.getAttribute('data-book-id');

    fetch('/api/books/' + bookId + '/reviews', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(function (res) {
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
          res.json().then(function (data) {
            alert(data.error || 'Failed to delete review.');
          });
        }
      })
      .catch(function () {
        alert('Network error. Please try again.');
      });
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
})();
