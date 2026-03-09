/**
 * admin-reviews.js — Search, sort, view toggle, delete for admin reviews.
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
      // Also hide/show the expand row immediately following
      var next = row.nextElementSibling;
      if (next && next.classList.contains('review-expand-row')) {
        next.style.display = match ? '' : 'none';
      }
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

    // Collect row pairs (main row + optional expand row)
    var pairs = [];
    var rows = tbody.querySelectorAll('.js-review-row');
    rows.forEach(function (row) {
      var expand = row.nextElementSibling;
      var hasExpand = expand && expand.classList.contains('review-expand-row');
      pairs.push({ main: row, expand: hasExpand ? expand : null });
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
      if (pair.expand) tbody.appendChild(pair.expand);
    });
  }

  // ===========================================================================
  // Toggle expand review body
  // ===========================================================================
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.js-toggle-review');
    if (!btn) return;

    var mainRow = btn.closest('tr');
    var expandRow = mainRow.nextElementSibling;
    if (!expandRow || !expandRow.classList.contains('review-expand-row')) return;

    expandRow.classList.toggle('is-open');
    var isOpen = expandRow.classList.contains('is-open');
    btn.textContent = isOpen ? 'Hide' : 'View';
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  // ===========================================================================
  // Delete review
  // ===========================================================================
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('.js-delete-review');
    if (!btn) return;

    var reviewId = btn.dataset.reviewId;
    var name = btn.dataset.name;

    if (!await showConfirm('Delete this review by ' + name + '? This cannot be undone.', { danger: true })) return;

    btn.disabled = true;
    btn.textContent = 'Deleting\u2026';

    try {
      var res = await fetch('/api/admin/reviews/' + reviewId, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
      });
      var data = await res.json();

      if (res.ok && data.success) {
        var row = btn.closest('tr');
        if (row) {
          var expandRow = row.nextElementSibling;
          if (expandRow && expandRow.classList.contains('review-expand-row')) {
            expandRow.remove();
          }
          animateRowOut(row, function () {
            showToast('Review deleted', 'success');
            // Update count
            if (countEl) {
              var current = parseInt(countEl.textContent, 10) || 0;
              countEl.textContent = Math.max(0, current - 1);
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
    btn.textContent = 'Delete';
  });
})();
