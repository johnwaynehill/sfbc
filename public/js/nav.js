/**
 * nav.js — Mobile hamburger menu toggle for global nav and admin nav.
 */
(function () {
  'use strict';

  function initToggle(navEl) {
    if (!navEl) return;
    var toggle = navEl.querySelector('.nav-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = navEl.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close menu when a link is clicked
    navEl.querySelectorAll('.nav-links a').forEach(function (link) {
      link.addEventListener('click', function () {
        navEl.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (e) {
      if (navEl.classList.contains('is-open') && !navEl.contains(e.target)) {
        navEl.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Public nav
  initToggle(document.querySelector('.global-nav'));

  // Admin nav
  initToggle(document.querySelector('.admin-nav'));
})();
