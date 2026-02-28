/**
 * admin-reviews.js — Delete review action for admin reviews page
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

  // ---- Toggle expand review body ----
  document.querySelectorAll('.js-toggle-review').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mainRow = btn.closest('tr');
      var expandRow = mainRow.nextElementSibling;
      if (!expandRow || !expandRow.classList.contains('review-expand-row')) return;

      expandRow.classList.toggle('is-open');
      var isOpen = expandRow.classList.contains('is-open');
      btn.textContent = isOpen ? 'Hide' : 'View';
      btn.setAttribute('aria-expanded', String(isOpen));
    });
  });

  // ---- Delete review ----
  document.querySelectorAll('.js-delete-review').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var reviewId = btn.dataset.reviewId;
      var name = btn.dataset.name;

      if (!confirm('Delete this review by ' + name + '? This cannot be undone.')) {
        return;
      }

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
            // Also remove the expand row if it exists
            var expandRow = row.nextElementSibling;
            if (expandRow && expandRow.classList.contains('review-expand-row')) {
              expandRow.remove();
            }
            animateRowOut(row, function () {
              showToast('Review deleted', 'success');
            });
          }
          return;
        }

        alert(data.error || 'Failed to delete review.');
      } catch (err) {
        alert('Network error. Please try again.');
      }

      btn.disabled = false;
      btn.textContent = 'Delete';
    });
  });
})();
