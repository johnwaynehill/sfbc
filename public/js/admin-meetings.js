/**
 * admin-meetings.js — Progressive enhancement for admin meeting management.
 *
 * 1. Create meeting form submission
 * 2. Status transition buttons
 * 3. Add nominee form submission
 * 4. Remove nominee buttons
 */
(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function showMessage(el, msg, isError) {
    if (!el) return;
    el.hidden = false;
    el.className = 'nom-message nom-message--' + (isError ? 'error' : 'success');
    el.textContent = msg;
  }

  // -----------------------------------------------------------------------
  // Create meeting form
  // -----------------------------------------------------------------------

  var createForm = document.getElementById('create-meeting-form');

  if (createForm) {
    var createBtn = document.getElementById('create-submit');
    var createMsg = document.getElementById('create-message');

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
          window.location.href = '/admin/meetings/' + data.meeting.id;
          return;
        }

        showMessage(createMsg, data.error || 'Something went wrong.', true);
      } catch (err) {
        showMessage(createMsg, 'Network error. Please try again.', true);
      }

      createBtn.disabled = false;
      createBtn.textContent = 'Create Meeting';
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
        voting: 'start voting',
        results: 'finalize results',
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
})();
