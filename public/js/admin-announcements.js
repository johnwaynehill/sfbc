/**
 * Admin — Announcements CRUD
 */
(function () {
  'use strict';

  var form = document.getElementById('announcement-form');
  var msg = document.getElementById('announcement-message');
  var list = document.getElementById('announcement-list');

  function showMsg(text, type) {
    if (!msg) return;
    msg.hidden = false;
    msg.className = 'nom-message nom-message--' + (type || 'success');
    msg.textContent = text;
    if (type !== 'error') {
      setTimeout(function () { msg.hidden = true; }, 3000);
    }
  }

  // ---- Create ----
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = document.getElementById('announcement-submit');
      btn.disabled = true;
      btn.textContent = 'Creating\u2026';

      var formData = {
        type: form.querySelector('[name="type"]').value,
        title: form.querySelector('[name="title"]').value.trim(),
        body: form.querySelector('[name="body"]').value.trim() || null,
        expires_at: form.querySelector('[name="expires_at"]').value || null,
      };

      try {
        var res = await fetch('/api/admin/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(formData),
        });
        var data = await res.json();

        if (res.ok && data.success) {
          window.location.reload();
          return;
        }

        showMsg(data.error || 'Something went wrong.', 'error');
      } catch (err) {
        showMsg('Network error.', 'error');
      }

      btn.disabled = false;
      btn.textContent = 'Create';
    });
  }

  // ---- Deactivate / Activate / Delete ----
  if (list) {
    list.addEventListener('click', async function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;

      var action = btn.dataset.action;
      var id = btn.dataset.id;

      if (action === 'delete' && !confirm('Delete this announcement permanently?')) {
        return;
      }

      btn.disabled = true;
      btn.textContent = action === 'delete' ? 'Deleting\u2026' : (action === 'deactivate' ? 'Deactivating\u2026' : 'Activating\u2026');

      try {
        var method = action === 'delete' ? 'DELETE' : 'PUT';
        var url = '/api/admin/announcements/' + id;
        if (action !== 'delete') url += '/' + action;

        var res = await fetch(url, {
          method: method,
          headers: { 'Accept': 'application/json' },
        });

        if (res.ok) {
          window.location.reload();
          return;
        }

        var data = await res.json();
        showMsg(data.error || 'Something went wrong.', 'error');
      } catch (err) {
        showMsg('Network error.', 'error');
      }

      btn.disabled = false;
      btn.textContent = action.charAt(0).toUpperCase() + action.slice(1);
    });
  }
})();
