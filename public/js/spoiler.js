/**
 * Spoiler reveal toggle.
 * Clicking or pressing Enter/Space on a .spoiler element toggles its text.
 */
(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var el = e.target.closest('.spoiler');
    if (el) {
      el.classList.toggle('is-revealed');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      var el = e.target.closest('.spoiler');
      if (el) {
        e.preventDefault();
        el.classList.toggle('is-revealed');
      }
    }
  });
})();
