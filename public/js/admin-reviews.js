/**
 * admin-reviews.js — Search, sort, view dialog, delete for admin reviews.
 */
(function () {
  'use strict';

  // Grade order for sorting (low → high)
  var GRADE_ORDER = { 'F': 0, 'D-': 1, 'D': 2, 'D+': 3, 'C-': 4, 'C': 5, 'C+': 6, 'B-': 7, 'B': 8, 'B+': 9, 'A-': 10, 'A': 11, 'A+': 12, 'S': 13 };

  var tbody        = document.getElementById('reviewsBody');
  var countEl      = document.getElementById('reviewCount');
  var noResults    = document.getElementById('noResults');
  var searchInput  = document.getElementById('searchInput');
  var searchClear  = document.getElementById('searchClear');
  var sortBtn      = document.getElementById('sortBtn');
  var sortMenu     = document.getElementById('sortMenu');
  var sortDropdown = document.getElementById('sortDropdown');

  var sortMode = 'newest';

  // ===========================================================================
  // Toast helper
  // ===========================================================================
  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + (type || 'success');
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('is-visible'); });
    setTimeout(function () {
      toast.classList.remove('is-visible');
      toast.addEventListener('transitionend', function () { toast.remove(); });
    }, 3000);
  }

  // ===========================================================================
  // Row exit animation
  // ===========================================================================
  function animateRowOut(row, callback) {
    row.style.transition = 'opacity 250ms ease, transform 250ms ease';
    row.style.opacity = '0';
    row.style.transform = 'translateX(-12px)';
    row.addEventListener('transitionend', function handler() {
      row.removeEventListener('transitionend', handler);
      row.remove();
      if (callback) callback();
    });
  }

  // ===========================================================================
  // Search
  // ===========================================================================
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      filterRows();
      if (searchClear) searchClear.hidden = !searchInput.value;
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        searchInput.value = '';
        filterRows();
        if (searchClear) searchClear.hidden = true;
      }
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', function () {
      searchInput.value = '';
      searchInput.focus();
      filterRows();
      searchClear.hidden = true;
    });
  }

  // ===========================================================================
  // Sort dropdown
  // ===========================================================================
  function openSortMenu() {
    if (!sortDropdown) return;
    sortDropdown.classList.add('is-open');
    sortBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSortMenu() {
    if (!sortDropdown) return;
    sortDropdown.classList.remove('is-open');
    sortBtn.setAttribute('aria-expanded', 'false');
  }

  if (sortBtn) {
    sortBtn.addEventListener('click', function () {
      sortDropdown.classList.contains('is-open') ? closeSortMenu() : openSortMenu();
    });
  }

  if (sortMenu) {
    sortMenu.addEventListener('click', function (e) {
      var item = e.target.closest('.sort-dropdown__item');
      if (!item) return;

      var newMode = item.getAttribute('data-sort');
      if (newMode === sortMode) { closeSortMenu(); return; }

      sortMenu.querySelectorAll('.sort-dropdown__item').forEach(function (el) {
        el.classList.remove('is-selected');
        el.setAttribute('aria-selected', 'false');
      });
      item.classList.add('is-selected');
      item.setAttribute('aria-selected', 'true');

      sortMode = newMode;
      closeSortMenu();
      sortRows();
    });
  }

  document.addEventListener('click', function (e) {
    if (sortDropdown && !sortDropdown.contains(e.target)) closeSortMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSortMenu();
  });

  // ===========================================================================
  // Filter logic
  // ===========================================================================
  function filterRows() {
    if (!tbody) return;
    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var rows = tbody.querySelectorAll('.js-review-row');
    var visible = 0;

    rows.forEach(function (row) {
      var book     = row.getAttribute('data-book') || '';
      var author   = row.getAttribute('data-author') || '';
      var reviewer = row.getAttribute('data-reviewer') || '';
      var grade    = (row.getAttribute('data-grade') || '').toLowerCase();
      var match    = !query
        || book.indexOf(query) !== -1
        || author.indexOf(query) !== -1
        || reviewer.indexOf(query) !== -1
        || grade.indexOf(query) !== -1;

      row.style.display = match ? '' : 'none';
      if (match) visible++;
    });

    if (countEl) {
      countEl.textContent = query ? visible : (countEl.getAttribute('data-total') || visible);
    }
    if (noResults) noResults.hidden = visible > 0 || !query;
  }

  // ===========================================================================
  // Sort logic
  // ===========================================================================
  function sortRows() {
    if (!tbody) return;

    var pairs = [];
    var rows = tbody.querySelectorAll('.js-review-row');
    rows.forEach(function (row) {
      pairs.push({ main: row });
    });

    pairs.sort(function (a, b) {
      var va, vb;
      switch (sortMode) {
        case 'oldest':
          va = a.main.getAttribute('data-date') || '';
          vb = b.main.getAttribute('data-date') || '';
          return va.localeCompare(vb);
        case 'grade-high':
          va = GRADE_ORDER[a.main.getAttribute('data-grade')] || 0;
          vb = GRADE_ORDER[b.main.getAttribute('data-grade')] || 0;
          return vb - va;
        case 'grade-low':
          va = GRADE_ORDER[a.main.getAttribute('data-grade')] || 0;
          vb = GRADE_ORDER[b.main.getAttribute('data-grade')] || 0;
          return va - vb;
        case 'book-az':
          va = a.main.getAttribute('data-book') || '';
          vb = b.main.getAttribute('data-book') || '';
          return va.localeCompare(vb);
        default: // newest
          va = a.main.getAttribute('data-date') || '';
          vb = b.main.getAttribute('data-date') || '';
          return vb.localeCompare(va);
      }
    });

    pairs.forEach(function (pair) {
      tbody.appendChild(pair.main);
    });
  }

  // ===========================================================================
  // Review detail dialog (modal on desktop, bottom sheet on mobile)
  // ===========================================================================
  var _reviewDialog = null;

  function getReviewDialog() {
    if (_reviewDialog) return _reviewDialog;

    _reviewDialog = document.createElement('dialog');
    _reviewDialog.className = 'review-detail-dialog';
    _reviewDialog.setAttribute('aria-modal', 'true');
    _reviewDialog.setAttribute('aria-label', 'Review detail');
    _reviewDialog.innerHTML =
      '<div class="review-detail-dialog__body">' +
        '<div class="review-detail-dialog__header">' +
          '<div class="review-detail-dialog__meta">' +
            '<span class="grade-badge grade-badge--sm" id="rd-grade"></span>' +
            '<div class="review-detail-dialog__info">' +
              '<span class="t-body-bold" id="rd-book"></span>' +
              '<span class="t-caption text-secondary" id="rd-author"></span>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="review-detail-dialog__close" aria-label="Close">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="review-detail-dialog__reviewer">' +
          '<span class="t-caption text-secondary" id="rd-reviewer"></span>' +
          '<span class="t-caption text-secondary">&middot;</span>' +
          '<span class="t-caption text-secondary" id="rd-date"></span>' +
        '</div>' +
        '<div class="review-detail-dialog__content t-body" id="rd-content"></div>' +
        '<div class="review-detail-dialog__actions">' +
          '<button type="button" class="btn btn--danger btn--sm" id="rd-delete">Delete Review</button>' +
        '</div>' +
      '</div>';

    // Close on backdrop click
    _reviewDialog.addEventListener('click', function (e) {
      if (e.target === _reviewDialog) closeReviewDialog();
    });

    // Close on Escape
    _reviewDialog.addEventListener('cancel', function (e) {
      e.preventDefault();
      closeReviewDialog();
    });

    // Close button
    _reviewDialog.querySelector('.review-detail-dialog__close').addEventListener('click', function () {
      closeReviewDialog();
    });

    document.body.appendChild(_reviewDialog);
    return _reviewDialog;
  }

  function closeReviewDialog() {
    var dialog = getReviewDialog();
    dialog.classList.add('is-closing');
    setTimeout(function () {
      dialog.classList.remove('is-closing');
      dialog.close();
    }, 180);
  }

  function openReviewDialog(row) {
    var dialog = getReviewDialog();

    var grade = row.getAttribute('data-grade') || '';
    var bookTitle = row.getAttribute('data-book-title') || '';
    var bookAuthor = row.getAttribute('data-book-author') || '';
    var reviewer = row.getAttribute('data-reviewer-name') || '';
    var dateStr = row.getAttribute('data-date-display') || '';
    var body = row.getAttribute('data-body') || '';
    var reviewId = row.getAttribute('data-review-id') || '';

    // Grade badge
    var gradeEl = dialog.querySelector('#rd-grade');
    gradeEl.textContent = grade;
    var tierLetter = grade ? grade.charAt(0).toLowerCase() : '';
    var tierClass = tierLetter ? 'grade-badge--' + tierLetter : '';
    gradeEl.className = 'grade-badge grade-badge--sm' + (tierClass ? ' ' + tierClass : '');

    dialog.querySelector('#rd-book').textContent = bookTitle;
    dialog.querySelector('#rd-author').textContent = bookAuthor;
    dialog.querySelector('#rd-reviewer').textContent = reviewer;
    dialog.querySelector('#rd-date').textContent = dateStr;

    // Review body
    var contentEl = dialog.querySelector('#rd-content');
    if (body) {
      contentEl.textContent = body;
      contentEl.hidden = false;
    } else {
      contentEl.textContent = '';
      contentEl.hidden = true;
    }

    // Wire up delete button
    var deleteBtn = dialog.querySelector('#rd-delete');
    deleteBtn.disabled = false;
    deleteBtn.textContent = 'Delete Review';
    deleteBtn._reviewId = reviewId;
    deleteBtn._reviewerName = reviewer;
    deleteBtn._bookTitle = bookTitle;
    deleteBtn._sourceRow = row;

    dialog.showModal();
  }

  // ===========================================================================
  // View review — open dialog
  // ===========================================================================
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.js-view-review');
    if (!btn) return;

    var row = btn.closest('tr');
    if (!row) return;

    openReviewDialog(row);
  });

  // ===========================================================================
  // Delete review (from inside dialog)
  // ===========================================================================
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('#rd-delete');
    if (!btn || !btn._reviewId) return;

    var reviewId = btn._reviewId;
    var name = btn._reviewerName + ' on ' + btn._bookTitle;

    if (!await showConfirm('Delete this review by ' + name + '? This cannot be undone.', { danger: true })) return;

    btn.disabled = true;
    btn.textContent = 'Deleting…';

    try {
      var res = await fetch('/api/admin/reviews/' + reviewId, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
      });
      var data = await res.json();

      if (res.ok && data.success) {
        var row = btn._sourceRow;
        closeReviewDialog();

        if (row) {
          var nextFocus = row.nextElementSibling;
          if (!nextFocus || !nextFocus.classList.contains('js-review-row')) {
            nextFocus = row.previousElementSibling;
          }
          if (nextFocus) nextFocus.setAttribute('tabindex', '-1');

          animateRowOut(row, function () {
            showToast('Review deleted', 'success');
            if (countEl) {
              var current = parseInt(countEl.textContent, 10) || 0;
              countEl.textContent = Math.max(0, current - 1);
            }
            if (nextFocus && nextFocus.parentNode) {
              nextFocus.focus();
            } else if (tbody && tbody.parentNode) {
              tbody.parentNode.setAttribute('tabindex', '-1');
              tbody.parentNode.focus();
            }
          });
        }
        return;
      }

      showAlert(data.error || 'Failed to delete review.');
    } catch (err) {
      showAlert('Network error. Please try again.');
    }

    btn.disabled = false;
    btn.textContent = 'Delete Review';
  });
})();
