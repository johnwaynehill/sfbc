/**
 * admin-users.js — Delete user + send magic link actions
 */
(function () {
  'use strict';

  // ---- Toast helper ----
  function showToast(message, type) {
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + (type || 'success');
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(function () {
      toast.classList.add('is-visible');
    });

    // Auto-dismiss
    setTimeout(function () {
      toast.classList.remove('is-visible');
      toast.addEventListener('transitionend', function () {
        toast.remove();
      });
    }, 3000);
  }

  // ---- Row exit animation ----
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

  // ---- Delete user ----
  document.querySelectorAll('.js-delete-user').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var userId = btn.dataset.userId;
      var name = btn.dataset.name;

      if (!confirm('Delete user \u201c' + name + '\u201d? This will also remove their reviews. This cannot be undone.')) {
        return;
      }

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
            animateRowOut(row, function () {
              showToast(name + ' has been deleted', 'success');
            });
          }
          return;
        }

        alert(data.error || 'Failed to delete user.');
      } catch (err) {
        alert('Network error. Please try again.');
      }

      btn.disabled = false;
      btn.textContent = 'Delete';
    });
  });

  // ---- Send magic link ----
  document.querySelectorAll('.js-send-link').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var userId = btn.dataset.userId;
      var email = btn.dataset.email;

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

        alert(data.error || 'Failed to send link.');
      } catch (err) {
        alert('Network error. Please try again.');
      }

      btn.disabled = false;
      btn.textContent = 'Send Link';
    });
  });
})();
