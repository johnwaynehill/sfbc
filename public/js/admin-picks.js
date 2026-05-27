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

      if (!await showConfirm('Are you sure you want to ' + (labels[newStatus] || newStatus) + '?')) return;

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

        showAlert(data.error || 'Something went wrong.');
      } catch (err) {
        showAlert('Network error.');
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

      if (!await showConfirm('Override status from \u201c' + (statusLabels[currentStatus] || currentStatus) + '\u201d to \u201c' + (statusLabels[newStatus] || newStatus) + '\u201d?')) {
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

        showAlert(data.error || 'Something went wrong.');
      } catch (err) {
        showAlert('Network error.');
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

      if (!await showConfirm('Remove \u201c' + title + '\u201d from nominees?')) return;

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

        showAlert(data.error || 'Something went wrong.');
      } catch (err) {
        showAlert('Network error.');
      }

      btn.disabled = false;
      btn.textContent = 'Remove';
    });
  });

  // -----------------------------------------------------------------------
  // Edit nominee / Replace cover — unified modal
  // -----------------------------------------------------------------------

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  var editDialog = null;
  var _coverSearchTimer = null;

  function getEditDialog() {
    if (editDialog) return editDialog;
    var dialog = document.createElement('dialog');
    dialog.className = 'app-dialog edit-modal';
    dialog.innerHTML =
      '<div class="edit-modal__content">' +
        '<h3 class="edit-modal__heading t-body-bold">Edit Book</h3>' +
        '<div class="edit-modal__fields" id="edit-modal-fields">' +
          '<div class="edit-modal__field">' +
            '<label class="t-caption text-secondary" for="edit-modal-title">Title</label>' +
            '<input type="text" class="form-input form-input--sm" id="edit-modal-title" placeholder="Title">' +
          '</div>' +
          '<div class="edit-modal__field">' +
            '<label class="t-caption text-secondary" for="edit-modal-author">Author</label>' +
            '<input type="text" class="form-input form-input--sm" id="edit-modal-author" placeholder="Author">' +
          '</div>' +
        '</div>' +
        '<hr class="edit-modal__divider" id="edit-modal-divider">' +
        '<div class="edit-modal__cover-section">' +
          '<div class="edit-modal__cover-label">' +
            '<span class="t-caption-bold">Book Cover</span>' +
            '<span class="edit-modal__cover-status" id="edit-modal-cover-status"></span>' +
          '</div>' +
          '<div class="edit-modal__covers" id="edit-modal-covers"></div>' +
        '</div>' +
        '<div class="edit-modal__actions">' +
          '<button type="button" class="btn btn--ghost btn--sm" id="edit-modal-cancel">Cancel</button>' +
          '<button type="button" class="btn btn--primary btn--sm" id="edit-modal-save">Save Updates</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dialog);

    // Close on backdrop click
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });

    editDialog = dialog;
    return dialog;
  }

  function triggerCoverSearch(dialog) {
    clearTimeout(_coverSearchTimer);
    var titleInput = dialog.querySelector('#edit-modal-title');
    var authorInput = dialog.querySelector('#edit-modal-author');
    var q = (titleInput.value.trim() + ' ' + authorInput.value.trim()).trim();
    if (q.length < 3) return;
    _coverSearchTimer = setTimeout(function () {
      doModalCoverSearch(
        dialog.querySelector('#edit-modal-covers'),
        dialog.querySelector('#edit-modal-cover-status'),
        dialog._bookId,
        q
      );
    }, 500);
  }

  function showEditModal(opts) {
    var dialog = getEditDialog();
    var titleInput = dialog.querySelector('#edit-modal-title');
    var authorInput = dialog.querySelector('#edit-modal-author');
    var fieldsSection = dialog.querySelector('#edit-modal-fields');
    var divider = dialog.querySelector('#edit-modal-divider');
    var saveBtn = dialog.querySelector('#edit-modal-save');
    var cancelBtn = dialog.querySelector('#edit-modal-cancel');
    var coversEl = dialog.querySelector('#edit-modal-covers');
    var statusEl = dialog.querySelector('#edit-modal-cover-status');

    // Reset
    titleInput.value = opts.title || '';
    authorInput.value = opts.author || '';
    coversEl.innerHTML = '';
    statusEl.textContent = '';

    // Show/hide edit fields based on mode
    var isEditMode = !!opts.meetingId;
    fieldsSection.hidden = !isEditMode;
    divider.hidden = !isEditMode;
    dialog.querySelector('.edit-modal__heading').textContent = isEditMode ? 'Edit Nomination' : 'Replace Cover';
    saveBtn.textContent = isEditMode ? 'Save Updates' : 'Done';

    // Store current context
    dialog._bookId = opts.bookId;
    dialog._meetingId = opts.meetingId || null;

    // Debounced cover search on title/author input
    titleInput.oninput = function () { triggerCoverSearch(dialog); };
    authorInput.oninput = function () { triggerCoverSearch(dialog); };

    // Save handler (re-bind each time)
    var newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    var newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newCancelBtn.addEventListener('click', function () {
      dialog.close();
    });

    if (isEditMode) {
      newSaveBtn.addEventListener('click', function () {
        var title = titleInput.value.trim();
        var author = authorInput.value.trim();
        if (!title || !author) { showAlert('Title and author are required.'); return; }
        newSaveBtn.disabled = true;
        newSaveBtn.textContent = 'Saving\u2026';
        fetch('/api/admin/meetings/' + dialog._meetingId + '/nominees/' + dialog._bookId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ title: title, author: author }),
        })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (result) {
          if (result.ok && result.data.success) {
            // Update DOM
            var row = document.querySelector('.admin-nominee[data-book-id="' + dialog._bookId + '"]');
            if (row) {
              var titleEl = row.querySelector('.js-nominee-title');
              var authorEl = row.querySelector('.js-nominee-author');
              if (titleEl) titleEl.textContent = result.data.book.title;
              if (authorEl) authorEl.textContent = result.data.book.author;
            }
            newSaveBtn.textContent = 'Saved!';
            setTimeout(function () {
              newSaveBtn.textContent = 'Save Updates';
              dialog.close();
            }, 800);
          } else {
            showAlert(result.data.error || 'Something went wrong.');
          }
        })
        .catch(function () { showAlert('Network error.'); })
        .finally(function () { newSaveBtn.disabled = false; });
      });
    } else {
      // Cover-only mode — Done just closes
      newSaveBtn.addEventListener('click', function () {
        dialog.close();
      });
    }

    dialog.showModal();

    // Auto-search covers on open
    var autoQuery = (opts.title || '') + ' ' + (opts.author || '');
    if (autoQuery.trim().length >= 3) {
      doModalCoverSearch(coversEl, statusEl, dialog._bookId, autoQuery.trim());
    }
  }

  var _coverPageSize = 5;

  function doModalCoverSearch(container, statusEl, bookId, query, startIndex) {
    var isAppend = startIndex > 0;
    statusEl.textContent = 'Searching\u2026';

    if (!isAppend) {
      container.innerHTML = '';
      container._totalShown = 0;
    }

    // Remove existing Show More button before fetching
    var existingMore = container.parentNode.querySelector('.edit-modal__show-more');
    if (existingMore) existingMore.remove();

    fetch('/api/books/search-multi?q=' + encodeURIComponent(query) + '&maxResults=' + _coverPageSize + '&startIndex=' + (startIndex || 0))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.results || data.results.length === 0) {
          if (!isAppend) {
            statusEl.textContent = 'No covers found';
            container.innerHTML = '';
          } else {
            statusEl.textContent = container._totalShown + ' covers found';
          }
          return;
        }

        var html = '';
        for (var i = 0; i < data.results.length; i++) {
          var r = data.results[i];
          html += '<div class="edit-modal__cover-item" data-google-books-id="' + esc(r.googleBooksId) + '" data-book-id="' + bookId + '">'
            + '<img src="' + esc(r.coverUrl) + '" alt="' + esc(r.title) + '" loading="lazy">'
            + '</div>';
        }

        if (isAppend) {
          container.insertAdjacentHTML('beforeend', html);
        } else {
          container.innerHTML = html;
        }

        container._totalShown = (container._totalShown || 0) + data.results.length;
        statusEl.textContent = container._totalShown + ' covers found';

        // Add "Show More" button if we got a full page of results
        if (data.results.length >= _coverPageSize) {
          var nextIndex = (startIndex || 0) + _coverPageSize;
          var moreBtn = document.createElement('button');
          moreBtn.type = 'button';
          moreBtn.className = 'btn btn--ghost btn--xs edit-modal__show-more';
          moreBtn.textContent = 'Show More';
          moreBtn.addEventListener('click', function () {
            moreBtn.disabled = true;
            moreBtn.textContent = 'Loading\u2026';
            doModalCoverSearch(container, statusEl, bookId, query, nextIndex);
          });
          container.parentNode.appendChild(moreBtn);
        }
      })
      .catch(function () {
        statusEl.textContent = isAppend ? 'Load more failed' : 'Search failed';
        if (!isAppend) container.innerHTML = '';
      });
  }

  // Click handler for edit/cover buttons and cover results
  document.addEventListener('click', function (e) {
    // Edit nominee button → full modal
    var editBtn = e.target.closest('.js-edit-nominee');
    if (editBtn) {
      showEditModal({
        bookId: editBtn.dataset.bookId,
        title: editBtn.dataset.title,
        author: editBtn.dataset.author,
        meetingId: editBtn.dataset.meetingId,
      });
      return;
    }

    // Replace cover button (winner callout) → cover-only modal
    var coverBtn = e.target.closest('.js-replace-cover');
    if (coverBtn) {
      showEditModal({
        bookId: coverBtn.dataset.bookId,
        title: coverBtn.dataset.title,
        author: coverBtn.dataset.author,
        meetingId: null,
      });
      return;
    }

    // Cover result click
    var coverItem = e.target.closest('.edit-modal__cover-item');
    if (coverItem) {
      var gbid = coverItem.dataset.googleBooksId;
      var bkId = coverItem.dataset.bookId;
      showConfirm('Replace the cover with this image?').then(function (ok) {
        if (!ok) return;
        coverItem.style.opacity = '0.5';
        fetch('/api/admin/books/' + bkId + '/cover', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ googleBooksId: gbid }),
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            window.location.reload();
          } else {
            showAlert(data.error || 'Failed to replace cover.');
            coverItem.style.opacity = '1';
          }
        })
        .catch(function () {
          showAlert('Network error.');
          coverItem.style.opacity = '1';
        });
      });
      return;
    }
  });

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

      if (!await showConfirm('Permanently delete \u201c' + label + '\u201d? This will remove all nominations, votes, and results. This cannot be undone.', { danger: true, confirmText: 'Delete' })) {
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

        showAlert(data.error || 'Something went wrong.');
      } catch (err) {
        showAlert('Network error.');
      }

      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete Pick';
    });
  }

  // -----------------------------------------------------------------------
  // Events CRUD
  // -----------------------------------------------------------------------

  // Add event form
  var addEventForm = document.getElementById('add-event-form');
  if (addEventForm) {
    addEventForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var pickId = addEventForm.dataset.pickId;
      var body = {
        meeting_time: addEventForm.querySelector('[name="meeting_time"]').value,
        location_text: addEventForm.querySelector('[name="location_text"]').value.trim(),
        meetup_event_url: addEventForm.querySelector('[name="meetup_event_url"]').value.trim(),
      };
      try {
        var res = await fetch('/api/admin/picks/' + pickId + '/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body),
        });
        var data = await res.json();
        if (data.success) { window.location.reload(); return; }
        showAlert(data.error || 'Failed to add event.');
      } catch (err) {
        showAlert('Network error.');
      }
    });
  }

  // Edit/Delete/Save/Cancel event buttons
  document.addEventListener('click', function (e) {
    // Edit event
    var editEventBtn = e.target.closest('.js-edit-event');
    if (editEventBtn) {
      var evId = editEventBtn.dataset.eventId;
      var evRow = editEventBtn.closest('.admin-event');
      var evInfo = evRow ? evRow.querySelector('.admin-event__info') : null;
      var evActions = evRow ? evRow.querySelector('.admin-event__actions') : null;
      var evEdit = evRow ? evRow.querySelector('.admin-event-edit[data-event-id="' + evId + '"]') : null;
      if (evInfo) evInfo.hidden = true;
      if (evActions) evActions.hidden = true;
      if (evEdit) evEdit.hidden = false;
      return;
    }

    // Cancel edit event
    var cancelEditEvent = e.target.closest('.js-cancel-edit-event');
    if (cancelEditEvent) {
      var evRow = cancelEditEvent.closest('.admin-event');
      var evEdit = cancelEditEvent.closest('.admin-event-edit');
      if (evEdit) evEdit.hidden = true;
      var evInfo = evRow ? evRow.querySelector('.admin-event__info') : null;
      var evActions = evRow ? evRow.querySelector('.admin-event__actions') : null;
      if (evInfo) evInfo.hidden = false;
      if (evActions) evActions.hidden = false;
      return;
    }

    // Save event
    var saveEventBtn = e.target.closest('.js-save-event');
    if (saveEventBtn) {
      var pickId = saveEventBtn.dataset.pickId;
      var evId = saveEventBtn.dataset.eventId;
      var evEdit = saveEventBtn.closest('.admin-event-edit');
      var body = {
        meeting_time: evEdit.querySelector('[name="meeting_time"]').value,
        location_text: evEdit.querySelector('[name="location_text"]').value.trim(),
        meetup_event_url: evEdit.querySelector('[name="meetup_event_url"]').value.trim(),
      };
      saveEventBtn.disabled = true;
      saveEventBtn.textContent = 'Saving\u2026';
      fetch('/api/admin/picks/' + pickId + '/events/' + evId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body),
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) { window.location.reload(); return; }
        showAlert(data.error || 'Failed to save event.');
      })
      .catch(function () { showAlert('Network error.'); })
      .finally(function () {
        saveEventBtn.disabled = false;
        saveEventBtn.textContent = 'Save';
      });
      return;
    }

    // Delete event
    var deleteEventBtn = e.target.closest('.js-delete-event');
    if (deleteEventBtn) {
      var pickId = deleteEventBtn.dataset.pickId;
      var evId = deleteEventBtn.dataset.eventId;
      showConfirm('Delete this event?').then(function (ok) {
        if (!ok) return;
        deleteEventBtn.disabled = true;
        deleteEventBtn.textContent = 'Deleting\u2026';
        fetch('/api/admin/picks/' + pickId + '/events/' + evId, {
          method: 'DELETE',
          headers: { 'Accept': 'application/json' },
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            var row = deleteEventBtn.closest('.admin-event');
            if (row) row.remove();
            return;
          }
          showAlert(data.error || 'Failed to delete event.');
        })
        .catch(function () { showAlert('Network error.'); })
        .finally(function () {
          deleteEventBtn.disabled = false;
          deleteEventBtn.textContent = 'Delete';
        });
      });
      return;
    }
  });

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

          if (!await showConfirm('Remove \u201c' + t + '\u201d from nominees?')) return;

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
            showAlert(d.error || 'Something went wrong.');
          } catch (err) {
            showAlert('Network error.');
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
