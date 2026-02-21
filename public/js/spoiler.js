/**
 * Spoiler reveal toggle.
 * Clicking or pressing Enter/Space on a .spoiler element reveals its text.
 */
(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var el = e.target.closest('.spoiler');
    if (el) {
      el.classList.add('is-revealed');
      el.removeAttribute('role');
      el.removeAttribute('tabindex');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      var el = e.target.closest('.spoiler');
      if (el && !el.classList.contains('is-revealed')) {
        e.preventDefault();
        el.classList.add('is-revealed');
        el.removeAttribute('role');
        el.removeAttribute('tabindex');
      }
    }
  });
})();
