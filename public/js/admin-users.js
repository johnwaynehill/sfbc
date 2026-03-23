/**
 * admin-users.js — Search, sort, promote/demote, send link, delete for admin users.
 */
(function () {
  'use strict';

  var tbody        = document.getElementById('usersBody');
  var countEl      = document.getElementById('userCount');
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
    var rows = tbody.querySelectorAll('tr[data-user-id]');
    var visible = 0;

    rows.forEach(function (row) {
      var name  = row.getAttribute('data-name') || '';
      var email = row.getAttribute('data-email') || '';
      var role  = row.getAttribute('data-role') || '';
      var match = !query
        || name.indexOf(query) !== -1
        || email.indexOf(query) !== -1
        || role.indexOf(query) !== -1;

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

    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr[data-user-id]'));

    rows.sort(function (a, b) {
      var va, vb;
      switch (sortMode) {
        case 'oldest':
          va = a.getAttribute('data-date') || '';
          vb = b.getAttribute('data-date') || '';
          return va.localeCompare(vb);
        case 'name-az':
          va = a.getAttribute('data-name') || '';
          vb = b.getAttribute('data-name') || '';
          return va.localeCompare(vb);
        case 'name-za':
          va = a.getAttribute('data-name') || '';
          vb = b.getAttribute('data-name') || '';
          return vb.localeCompare(va);
        case 'role':
          va = a.getAttribute('data-role') === 'admin' ? 0 : 1;
          vb = b.getAttribute('data-role') === 'admin' ? 0 : 1;
          return va - vb || (a.getAttribute('data-date') || '').localeCompare(b.getAttribute('data-date') || '');
        default: // newest
          va = a.getAttribute('data-date') || '';
          vb = b.getAttribute('data-date') || '';
          return vb.localeCompare(va);
      }
    });

    rows.forEach(function (row) {
      tbody.appendChild(row);
    });
  }

  // ===========================================================================
  // Promote user to admin
  // ===========================================================================
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('.js-promote-user');
    if (!btn) return;

    var userId = btn.dataset.userId;
    var name = btn.dataset.name;

    if (!await showConfirm('Promote \u201c' + name + '\u201d to admin?')) return;

    btn.disabled = true;
    btn.textContent = 'Promoting\u2026';

    try {
      var res = await fetch('/api/admin/users/' + userId + '/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      });
      var data = await res.json();

      if (res.ok && data.success) {
        var row = btn.closest('tr');
        if (row) {
          row.setAttribute('data-role', 'admin');

          // Add admin badge
          var nameLine = row.querySelector('.user-row__name-line');
          if (nameLine && !nameLine.querySelector('.role-badge')) {
            var badge = document.createElement('span');
            badge.className = 'role-badge role-badge--admin';
            badge.textContent = 'admin';
            nameLine.appendChild(badge);
          }

          // Replace Promote with Demote
          var newBtn = document.createElement('button');
          newBtn.type = 'button';
          newBtn.className = 'btn btn--secondary btn--sm js-demote-user';
          newBtn.dataset.userId = userId;
          newBtn.dataset.name = name;
          newBtn.textContent = 'Demote';
          btn.replaceWith(newBtn);

          // Remove Delete button (admins can't be deleted)
          var deleteBtn = row.querySelector('.js-delete-user');
          if (deleteBtn) deleteBtn.remove();
        }

        showToast(name + ' promoted to admin', 'success');
        return;
      }

      showAlert(data.error || 'Failed to promote user.');
    } catch (err) {
      showAlert('Network error. Please try again.');
    }

    btn.disabled = false;
    btn.textContent = 'Promote';
  });

  // ===========================================================================
  // Demote user from admin
  // ===========================================================================
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('.js-demote-user');
    if (!btn) return;

    var userId = btn.dataset.userId;
    var name = btn.dataset.name;

    if (!await showConfirm('Demote \u201c' + name + '\u201d from admin to member?')) return;

    btn.disabled = true;
    btn.textContent = 'Demoting\u2026';

    try {
      var res = await fetch('/api/admin/users/' + userId + '/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ role: 'member' }),
      });
      var data = await res.json();

      if (res.ok && data.success) {
        var row = btn.closest('tr');
        if (row) {
          row.setAttribute('data-role', 'member');

          // Remove admin badge
          var badge = row.querySelector('.role-badge--admin');
          if (badge) badge.remove();

          // Replace Demote with Promote
          var newBtn = document.createElement('button');
          newBtn.type = 'button';
          newBtn.className = 'btn btn--secondary btn--sm js-promote-user';
          newBtn.dataset.userId = userId;
          newBtn.dataset.name = name;
          newBtn.textContent = 'Promote';
          btn.replaceWith(newBtn);

          // Add Delete button back
          var actions = row.querySelector('.user-actions');
          if (actions && !actions.querySelector('.js-delete-user')) {
            var deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn btn--danger btn--sm js-delete-user';
            deleteBtn.dataset.userId = userId;
            deleteBtn.dataset.name = name;
            deleteBtn.textContent = 'Delete';
            actions.appendChild(deleteBtn);
          }
        }

        showToast(name + ' demoted to member', 'success');
        return;
      }

      showAlert(data.error || 'Failed to demote user.');
    } catch (err) {
      showAlert('Network error. Please try again.');
    }

    btn.disabled = false;
    btn.textContent = 'Demote';
  });

  // ===========================================================================
  // Delete user
  // ===========================================================================
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('.js-delete-user');
    if (!btn) return;

    var userId = btn.dataset.userId;
    var name = btn.dataset.name;

    if (!await showConfirm('Delete user \u201c' + name + '\u201d? This will also remove their reviews. This cannot be undone.', { danger: true })) return;

    btn.disabled = true;
    btn.textContent = 'Deleting\u2026';

    try {
      var res = await fetch('/api/admin/users/' + userId, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
      });
      var data = await res.json();

      if (res.ok && data.success) {
        var row = btn.closest('tr');
        if (row) {
          var nextFocus = row.nextElementSibling || row.previousElementSibling;
          if (nextFocus) nextFocus.setAttribute('tabindex', '-1');
          animateRowOut(row, function () {
            showToast(name + ' has been deleted', 'success');
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

      showAlert(data.error || 'Failed to delete user.');
    } catch (err) {
      showAlert('Network error. Please try again.');
    }

    btn.disabled = false;
    btn.textContent = 'Delete';
  });

  // ===========================================================================
  // Send magic link
  // ===========================================================================
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('.js-send-link');
    if (!btn) return;

    var userId = btn.dataset.userId;
    var email = btn.dataset.email;

    if (!await showConfirm('Send a magic login link to ' + email + '?')) return;

    btn.disabled = true;
    btn.textContent = 'Sending\u2026';

    try {
      var res = await fetch('/api/admin/users/' + userId + '/send-magic-link', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
      });
      var data = await res.json();

      if (res.ok && data.success) {
        showToast('Magic link sent to ' + email, 'success');
        btn.textContent = 'Sent \u2713';
        setTimeout(function () {
          btn.disabled = false;
          btn.textContent = 'Send Link';
        }, 3000);
        return;
      }

      showAlert(data.error || 'Failed to send link.');
    } catch (err) {
      showAlert('Network error. Please try again.');
    }

    btn.disabled = false;
    btn.textContent = 'Send Link';
  });
})();
