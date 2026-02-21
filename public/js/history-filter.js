(function () {
  'use strict';

  var grid = document.getElementById('historyGrid');
  if (!grid) return;

  var searchBtn   = document.getElementById('searchBtn');
  var searchWrap  = document.getElementById('searchWrap');
  var searchInput = document.getElementById('searchInput');
  var searchClose = document.getElementById('searchClose');
  var sortBtn     = document.getElementById('sortBtn');
  var sortMenu    = document.getElementById('sortMenu');
  var sortDropdown = document.getElementById('sortDropdown');
  var noResults   = document.getElementById('noResults');

  var sortMode = 'newest';

  // ── Search expand / collapse ──────────────────────────────
  function openSearch() {
    closeSortMenu();
    searchWrap.classList.add('is-open');
    searchBtn.hidden = true;
    searchInput.focus();
  }

  function closeSearch() {
    searchWrap.classList.remove('is-open');
    searchBtn.hidden = false;
    if (searchInput.value) {
      searchInput.value = '';
      filterCards();
    }
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', openSearch);
  }
  if (searchClose) {
    searchClose.addEventListener('click', closeSearch);
  }

  if (searchInput) {
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSearch();
    });
    searchInput.addEventListener('input', filterCards);
  }

  // ── Sort dropdown ─────────────────────────────────────────
  function openSortMenu() {
    sortDropdown.classList.add('is-open');
    sortBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSortMenu() {
    sortDropdown.classList.remove('is-open');
    sortBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleSortMenu() {
    if (sortDropdown.classList.contains('is-open')) {
      closeSortMenu();
    } else {
      openSortMenu();
    }
  }

  if (sortBtn) {
    sortBtn.addEventListener('click', toggleSortMenu);
  }

  // Select a sort option
  if (sortMenu) {
    sortMenu.addEventListener('click', function (e) {
      var item = e.target.closest('.sort-dropdown__item');
      if (!item) return;

      var newMode = item.getAttribute('data-sort');
      if (newMode === sortMode) {
        closeSortMenu();
        return;
      }

      // Update selected state
      var items = sortMenu.querySelectorAll('.sort-dropdown__item');
      items.forEach(function (el) {
        el.classList.remove('is-selected');
        el.setAttribute('aria-selected', 'false');
      });
      item.classList.add('is-selected');
      item.setAttribute('aria-selected', 'true');

      sortMode = newMode;
      closeSortMenu();
      sortCards();
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', function (e) {
    if (sortDropdown && !sortDropdown.contains(e.target)) {
      closeSortMenu();
    }
  });

  // Close dropdown on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSortMenu();
  });

  // ── Filter logic ──────────────────────────────────────────
  function filterCards() {
    var query = searchInput.value.trim().toLowerCase();
    var cards = grid.querySelectorAll('.book-card');
    var visible = 0;

    cards.forEach(function (card) {
      var title  = card.getAttribute('data-title') || '';
      var author = card.getAttribute('data-author') || '';
      var match  = !query || title.indexOf(query) !== -1 || author.indexOf(query) !== -1;
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });

    if (noResults) {
      noResults.hidden = visible > 0 || !query;
    }
  }

  // ── Sort logic ────────────────────────────────────────────
  function sortCards() {
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.book-card'));

    cards.sort(function (a, b) {
      var ta, tb, da, db;
      switch (sortMode) {
        case 'alpha':
          ta = a.getAttribute('data-title') || '';
          tb = b.getAttribute('data-title') || '';
          return ta.localeCompare(tb);
        case 'alpha-desc':
          ta = a.getAttribute('data-title') || '';
          tb = b.getAttribute('data-title') || '';
          return tb.localeCompare(ta);
        case 'oldest':
          da = a.getAttribute('data-date') || '';
          db = b.getAttribute('data-date') || '';
          return da.localeCompare(db);
        default: // newest
          da = a.getAttribute('data-date') || '';
          db = b.getAttribute('data-date') || '';
          return db.localeCompare(da);
      }
    });

    cards.forEach(function (card) {
      grid.appendChild(card);
    });
  }
})();
