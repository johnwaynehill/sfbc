/**
 * admin-picks.js — Progressive enhancement for admin pick management.
 *
 * 1. Create pick form submission
 * 2. Status transition buttons
 * 3. Add nominee form submission
 * 4. Remove nominee buttons
 */
(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  var MONTH_NAMES = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];

  function monthYearSlug(my) {
    if (!my) return '';
    var parts = my.split('-');
    var idx = parseInt(parts[1], 10) - 1;
    return (MONTH_NAMES[idx] || parts[1]) + '-' + parts[0];
  }

  function showMessage(el, msg, isError) {
    if (!el) return;
    el.hidden = false;
    el.className = 'nom-message nom-message--' + (isError ? 'error' : 'success');
    el.textContent = msg;
  }

  // -----------------------------------------------------------------------
  // Create pick form
  // -----------------------------------------------------------------------

  var createForm = document.getElementById('create-meeting-form');

  if (createForm) {
    var createBtn = document.getElementById('create-submit');
    var createMsg = document.getElementById('create-message');

    // Pre-fill from URL params (for "Create Next Pick" flow)
    var _params = new URLSearchParams(window.location.search);
    var _prefillMonth = _params.get('month');
    if (_prefillMonth) {
      var _monthInput = createForm.querySelector('[name="month_year"]');
      if (_monthInput) _monthInput.value = _prefillMonth;
    }

    createForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      var formData = new FormData(createForm);
      var body = {};
      formData.forEach(function (val, key) { body[key] = val; });

      createBtn.disabled = true;
      createBtn.textContent = 'Creating\u2026';

      try {
        var res = await fetch('/api/admin/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body),
        });

        var data = await res.json();

        if (res.ok && data.success) {
          window.location.href = '/admin/picks/' + monthYearSlug(data.meeting.month_year);
          return;
        }

        showMessage(createMsg, data.error || 'Something went wrong.', true);
      } catch (err) {
        showMessage(createMsg, 'Network error. Please try again.', true);
      }

      createBtn.disabled = false;
      createBtn.textContent = 'Create Pick';
    });
  }

  // -----------------------------------------------------------------------
  // Status transition buttons
  // -----------------------------------------------------------------------

  document.querySelectorAll('.js-advance-status').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var meetingId = btn.dataset.meetingId;
      var newStatus = btn.dataset.newStatus;
      var labels = {
        nominations: 'open nominations',
        voting: 'close nominations and open voting',
        upcoming: 'close voting and determine the winner',
        reading: 'start the reading period',
        results: 'mark this pick as finished',
        scheduled: 'open nominations',
      };

      if (!confirm('Are you sure you want to ' + (labels[newStatus] || newStatus) + '?')) return;

      var originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Updating\u2026';

      try {
        var res = await fetch('/api/admin/meetings/' + meetingId + '/status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });

        var data = await res.json();

        if (res.ok && data.success) {
          window.location.reload();
          return;
        }

        alert(data.error || 'Something went wrong.');
      } catch (err) {
        alert('Network error.');
      }

      btn.disabled = false;
      btn.textContent = originalText;
    });
  });

  // -----------------------------------------------------------------------
  // Status override dropdown + Apply button
  // -----------------------------------------------------------------------

  var statusSelect = document.getElementById('status-override-select');
  var statusBtn = document.getElementById('status-override-btn');

  if (statusSelect && statusBtn) {
    // Enable/disable the Apply button based on selection
    statusSelect.addEventListener('change', function () {
      statusBtn.disabled = !statusSelect.value;
    });

    statusBtn.addEventListener('click', async function () {
      var meetingId = statusSelect.dataset.meetingId;
      var currentStatus = statusSelect.dataset.currentStatus;
      var newStatus = statusSelect.value;
      var statusLabels = {
        scheduled: 'Scheduled',
        upcoming: 'Upcoming',
        reading: 'Reading',
        nominations: 'Nominations',
        voting: 'Voting',
        results: 'Finished',
      };

      if (!newStatus || newStatus === currentStatus) return;

      if (!confirm('Override status from "' + (statusLabels[currentStatus] || currentStatus) + '" to "' + (statusLabels[newStatus] || newStatus) + '"?')) {
        return;
      }

      statusSelect.disabled = true;
      statusBtn.disabled = true;
      statusBtn.textContent = 'Applying\u2026';

      try {
        var res = await fetch('/api/admin/meetings/' + meetingId + '/force-status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });

        var data = await res.json();

        if (res.ok && data.success) {
          window.location.reload();
          return;
        }

        alert(data.error || 'Something went wrong.');
      } catch (err) {
        alert('Network error.');
      }

      statusSelect.disabled = false;
      statusBtn.disabled = false;
      statusBtn.textContent = 'Apply';
    });
  }

  // -----------------------------------------------------------------------
  // Remove nominee buttons
  // -----------------------------------------------------------------------

  document.querySelectorAll('.js-remove-nominee').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var meetingId = btn.dataset.meetingId;
      var bookId = btn.dataset.bookId;
      var title = btn.dataset.title;

      if (!confirm('Remove "' + title + '" from nominees?')) return;

      btn.disabled = true;
      btn.textContent = 'Removing\u2026';

      try {
        var res = await fetch('/api/admin/meetings/' + meetingId + '/nominees/' + bookId, {
          method: 'DELETE',
          headers: { 'Accept': 'application/json' },
        });

        var data = await res.json();

        if (res.ok && data.success) {
          // Remove the nominee row from DOM
          var row = btn.closest('.admin-nominee');
          if (row) row.remove();
          return;
        }

        alert(data.error || 'Something went wrong.');
      } catch (err) {
        alert('Network error.');
      }

      btn.disabled = false;
      btn.textContent = 'Remove';
    });
  });

  // -----------------------------------------------------------------------
  // Edit nominee (inline)
  // -----------------------------------------------------------------------

  document.addEventListener('click', function (e) {
    // Edit button
    var editBtn = e.target.closest('.js-edit-nominee');
    if (editBtn) {
      var row = editBtn.closest('.admin-nominee');
      if (!row) return;
      var bookId = editBtn.dataset.bookId;
      var display = row.querySelector('.js-nominee-display[data-book-id="' + bookId + '"]');
      var form = row.querySelector('.admin-nominee-edit[data-book-id="' + bookId + '"]');
      if (display) display.hidden = true;
      if (form) form.hidden = false;
      editBtn.hidden = true;
      return;
    }

    // Cancel button
    var cancelBtn = e.target.closest('.js-cancel-edit-nominee');
    if (cancelBtn) {
      var row = cancelBtn.closest('.admin-nominee');
      if (!row) return;
      var form = cancelBtn.closest('.admin-nominee-edit');
      var bookId = form ? form.dataset.bookId : null;
      if (form) form.hidden = true;
      var display = row.querySelector('.js-nominee-display[data-book-id="' + bookId + '"]');
      if (display) display.hidden = false;
      var editBtn2 = row.querySelector('.js-edit-nominee[data-book-id="' + bookId + '"]');
      if (editBtn2) editBtn2.hidden = false;
      return;
    }

    // Save button
    var saveBtn = e.target.closest('.js-save-nominee');
    if (saveBtn) {
      var meetingId = saveBtn.dataset.meetingId;
      var bookId = saveBtn.dataset.bookId;
      var row = saveBtn.closest('.admin-nominee');
      var form = saveBtn.closest('.admin-nominee-edit');
      if (!form) return;

      var title = form.querySelector('[name="title"]').value.trim();
      var author = form.querySelector('[name="author"]').value.trim();
      var reason = form.querySelector('[name="reason"]').value.trim();

      if (!title || !author) { alert('Title and author are required.'); return; }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving\u2026';

      fetch('/api/admin/meetings/' + meetingId + '/nominees/' + bookId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ title: title, author: author, reason: reason }),
      })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (result) {
        if (result.ok && result.data.success) {
          // Update display values
          var display = row.querySelector('.js-nominee-display[data-book-id="' + bookId + '"]');
          if (display) {
            var titleEl = display.querySelector('.js-nominee-title');
            var authorEl = display.querySelector('.js-nominee-author');
            var reasonEl = display.querySelector('.js-nominee-reason');
            if (titleEl) titleEl.textContent = result.data.book.title;
            if (authorEl) authorEl.textContent = result.data.book.author;
            if (reasonEl && result.data.book.reason) {
              reasonEl.innerHTML = '&ldquo;' + esc(result.data.book.reason) + '&rdquo;';
            } else if (reasonEl && !result.data.book.reason) {
              reasonEl.remove();
            } else if (!reasonEl && result.data.book.reason) {
              var p = document.createElement('p');
              p.className = 't-caption text-secondary js-nominee-reason';
              p.style.cssText = 'margin-top: var(--s-1); font-style: italic;';
              p.innerHTML = '&ldquo;' + esc(result.data.book.reason) + '&rdquo;';
              display.appendChild(p);
            }
            display.hidden = false;
          }
          form.hidden = true;
          var editBtn3 = row.querySelector('.js-edit-nominee[data-book-id="' + bookId + '"]');
          if (editBtn3) editBtn3.hidden = false;
        } else {
          alert(result.data.error || 'Something went wrong.');
        }
      })
      .catch(function () { alert('Network error.'); })
      .finally(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      });
    }
  });

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // -----------------------------------------------------------------------
  // Edit meeting details (toggle + form)
  // -----------------------------------------------------------------------

  var toggleEditBtn = document.getElementById('toggle-edit-btn');
  var cancelEditBtn = document.getElementById('cancel-edit-btn');
  var detailsView = document.getElementById('meeting-details-view');
  var detailsEdit = document.getElementById('meeting-details-edit');
  var editForm = document.getElementById('edit-meeting-form');

  if (toggleEditBtn && detailsView && detailsEdit) {
    toggleEditBtn.addEventListener('click', function () {
      detailsView.hidden = true;
      detailsEdit.classList.add('is-open');
      toggleEditBtn.hidden = true;
    });

    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', function () {
        detailsView.hidden = false;
        detailsEdit.classList.remove('is-open');
        toggleEditBtn.hidden = false;
      });
    }
  }

  if (editForm) {
    var editBtn = document.getElementById('edit-submit');
    var editMsg = document.getElementById('edit-message');

    editForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      var formData = new FormData(editForm);
      var body = {};
      formData.forEach(function (val, key) { body[key] = val; });
      var meetingId = editForm.dataset.meetingId;

      editBtn.disabled = true;
      editBtn.textContent = 'Saving\u2026';

      try {
        var res = await fetch('/api/admin/meetings/' + meetingId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body),
        });

        var data = await res.json();

        if (res.ok && data.success) {
          // Redirect to the new slug URL (month_year might have changed)
          window.location.href = '/admin/picks/' + monthYearSlug(data.meeting.month_year);
          return;
        }

        showMessage(editMsg, data.error || 'Something went wrong.', true);
      } catch (err) {
        showMessage(editMsg, 'Network error. Please try again.', true);
      }

      editBtn.disabled = false;
      editBtn.textContent = 'Save Changes';
    });
  }

  // -----------------------------------------------------------------------
  // Add nominee form
  // -----------------------------------------------------------------------

  var addForm = document.getElementById('add-nominee-form');

  if (addForm) {
    var addBtn = document.getElementById('add-nominee-submit');
    var addMsg = document.getElementById('nominee-message');

    addForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      var title = addForm.querySelector('[name="title"]').value.trim();
      var author = addForm.querySelector('[name="author"]').value.trim();
      var meetingId = addForm.dataset.meetingId;

      if (!title || !author) {
        showMessage(addMsg, 'Title and author are required.', true);
        return;
      }

      addBtn.disabled = true;
      addBtn.textContent = 'Adding\u2026';

      try {
        var res = await fetch('/api/admin/meetings/' + meetingId + '/nominees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ title: title, author: author }),
        });

        var data = await res.json();

        if (res.ok && data.success) {
          // Reload to show the new nominee
          window.location.reload();
          return;
        }

        showMessage(addMsg, data.error || 'Something went wrong.', true);
      } catch (err) {
        showMessage(addMsg, 'Network error. Please try again.', true);
      }

      addBtn.disabled = false;
      addBtn.textContent = 'Add';
    });
  }

  // -----------------------------------------------------------------------
  // Delete pick (super-admin only)
  // -----------------------------------------------------------------------

  var deleteBtn = document.getElementById('delete-meeting-btn');

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async function () {
      var meetingId = deleteBtn.dataset.meetingId;
      var label = deleteBtn.dataset.meetingLabel || 'this pick';

      if (!confirm('Are you sure you want to permanently delete "' + label + '"?\n\nThis will remove all nominations, votes, and results. This cannot be undone.')) {
        return;
      }

      // Double-confirm
      if (!confirm('This action is irreversible. Delete "' + label + '"?')) {
        return;
      }

      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting\u2026';

      try {
        var res = await fetch('/api/admin/meetings/' + meetingId, {
          method: 'DELETE',
          headers: { 'Accept': 'application/json' },
        });

        var data = await res.json();

        if (res.ok && data.success) {
          window.location.href = '/admin/picks';
          return;
        }

        alert(data.error || 'Something went wrong.');
      } catch (err) {
        alert('Network error.');
      }

      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete Pick';
    });
  }

  // -----------------------------------------------------------------------
  // SSE: live nominee + vote count updates
  // -----------------------------------------------------------------------

  var meetingConfig = window.__MEETING_CONFIG__;
  if (meetingConfig && meetingConfig.meetingId) {
    var nomineesContainer = document.querySelector('.admin-nominees');
    var nomineesHeading = document.querySelector('.admin-page__subheading');
    var isFirstNominees = true;
    var isFirstVoteCount = true;
    var sseDelay = 1000;
    var sseMaxDelay = 30000;
    var meetingEs = null;

    function esc(str) {
      var d = document.createElement('div');
      d.textContent = str || '';
      return d.innerHTML;
    }

    function renderNominees(nominees) {
      if (!nomineesContainer) return;

      // Update count in heading
      if (nomineesHeading) {
        nomineesHeading.textContent = 'Nominees (' + nominees.length + ')';
      }

      // Update pipeline nominee count + readiness check
      var pnc = document.getElementById('pipeline-nominee-count');
      if (pnc) {
        pnc.textContent = nominees.length;
        var pnCheck = pnc.closest('.pipeline-check');
        if (pnCheck) {
          var pnReady = nominees.length >= 2;
          pnCheck.classList.toggle('pipeline-check--ok', pnReady);
          pnCheck.classList.toggle('pipeline-check--warn', !pnReady);
          var pnIcon = pnCheck.querySelector('.pipeline-check__icon');
          if (pnIcon) pnIcon.textContent = pnReady ? '\u2713' : '!';
          var pnHint = pnCheck.querySelector('.pipeline-check__hint');
          if (pnHint) pnHint.hidden = pnReady;
          var pnCta = document.querySelector('.pipeline-cta[data-new-status="voting"]');
          if (pnCta) pnCta.disabled = !pnReady;
        }
      }

      if (nominees.length === 0) {
        nomineesContainer.innerHTML = '<p class="t-body text-secondary">No nominees yet.</p>';
        return;
      }

      var canRemove = meetingConfig.status === 'nominations' || meetingConfig.status === 'voting';
      var html = '';

      for (var i = 0; i < nominees.length; i++) {
        var nom = nominees[i];
        html += '<div class="admin-nominee" data-book-id="' + nom.book_id + '">';

        if (nom.cover_url) {
          html += '<div class="book-cover book-cover--xs">'
            + '<img src="' + esc(nom.cover_url) + '" alt="' + esc(nom.title) + '" loading="lazy">'
            + '</div>';
        }

        html += '<div class="admin-nominee__info">'
          + '<span class="t-body">' + esc(nom.title) + '</span>'
          + '<span class="t-caption text-secondary">' + esc(nom.author) + '</span>'
          + '<span class="t-caption text-secondary" style="opacity: 0.5;">';

        if (nom.nominator_name) {
          html += 'Nominated by ' + esc(nom.nominator_name);
        } else {
          html += esc(nom.source || '');
        }

        html += '</span></div>';

        if (canRemove) {
          html += '<button class="btn btn--danger btn--sm js-remove-nominee"'
            + ' data-meeting-id="' + meetingConfig.meetingId + '"'
            + ' data-book-id="' + nom.book_id + '"'
            + ' data-title="' + esc(nom.title) + '">Remove</button>';
        }

        html += '</div>';
      }

      nomineesContainer.innerHTML = html;

      // Re-bind remove buttons for newly rendered nominees
      nomineesContainer.querySelectorAll('.js-remove-nominee').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var mId = btn.dataset.meetingId;
          var bId = btn.dataset.bookId;
          var t = btn.dataset.title;

          if (!confirm('Remove "' + t + '" from nominees?')) return;

          btn.disabled = true;
          btn.textContent = 'Removing\u2026';

          try {
            var r = await fetch('/api/admin/meetings/' + mId + '/nominees/' + bId, {
              method: 'DELETE',
              headers: { 'Accept': 'application/json' },
            });
            var d = await r.json();
            if (r.ok && d.success) {
              var row = btn.closest('.admin-nominee');
              if (row) row.remove();
              return;
            }
            alert(d.error || 'Something went wrong.');
          } catch (err) {
            alert('Network error.');
          }
          btn.disabled = false;
          btn.textContent = 'Remove';
        });
      });
    }

    function connectMeetingSse() {
      meetingEs = new EventSource('/api/admin/meetings/' + meetingConfig.meetingId + '/stream');

      meetingEs.onopen = function () {
        sseDelay = 1000;
      };

      meetingEs.addEventListener('nominees', function (e) {
        try {
          var data = JSON.parse(e.data);
          if (isFirstNominees) { isFirstNominees = false; return; }
          renderNominees(data);
        } catch (err) {}
      });

      meetingEs.addEventListener('voteCount', function (e) {
        try {
          var data = JSON.parse(e.data);
          if (isFirstVoteCount) { isFirstVoteCount = false; return; }
          var vcEl = document.getElementById('admin-vote-count');
          if (vcEl) {
            vcEl.textContent = data.voteCount;
            // Update pipeline check state
            var vcCheck = vcEl.closest('.pipeline-check');
            if (vcCheck) {
              var vcReady = data.voteCount >= 1;
              vcCheck.classList.toggle('pipeline-check--ok', vcReady);
              vcCheck.classList.toggle('pipeline-check--warn', !vcReady);
              var vcIcon = vcCheck.querySelector('.pipeline-check__icon');
              if (vcIcon) vcIcon.textContent = vcReady ? '\u2713' : '!';
              var vcHint = vcCheck.querySelector('.pipeline-check__hint');
              if (vcHint) vcHint.hidden = vcReady;
              var vcCta = document.querySelector('.pipeline-cta[data-new-status="upcoming"]');
              if (vcCta) vcCta.disabled = !vcReady;
            }
          }
        } catch (err) {}
      });

      meetingEs.onerror = function () {
        meetingEs.close();
        isFirstNominees = true;
        isFirstVoteCount = true;
        setTimeout(connectMeetingSse, sseDelay);
        sseDelay = Math.min(sseDelay * 2, sseMaxDelay);
      };
    }

    connectMeetingSse();
  }
})();
