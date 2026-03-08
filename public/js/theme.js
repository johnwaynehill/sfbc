/**
 * theme.js — Dark mode toggle logic
 *
 * Reads effective theme (localStorage → system preference fallback).
 * Click toggles light ↔ dark, saves to localStorage.
 * Updates sun/moon icon and <meta name="theme-color">.
 * Listens for OS preference changes (auto-adapts if no manual override).
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var META_LIGHT  = '#FFFFFF';
  var META_DARK   = '#1a1a1a';

  /** Return the currently effective theme: 'light' or 'dark'. */
  function getEffective() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /** Apply theme to DOM without animation on first load. */
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;

    // Update <meta name="theme-color">
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? META_DARK : META_LIGHT);
  }

  // Apply on load (FOUC script already set data-theme, but this also handles meta)
  apply(getEffective());

  // Bind all toggle buttons (may be more than one on the page)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.theme-toggle');
    if (!btn) return;

    var next = getEffective() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  });

  // Listen for OS preference changes (auto-adapt if no manual override)
  var mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', function () {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // No manual override — follow OS
      apply(getEffective());
    }
  });
})();
