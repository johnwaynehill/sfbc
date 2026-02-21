/**
 * results-live.js — SSE client for real-time results updates.
 *
 * Connects to /api/meetings/:meetingId/results/stream and updates:
 * - Bar widths (CSS transition handles smooth growth)
 * - Points labels (pop + glow on change)
 * - Vote count (pop + glow on change)
 * - Bar order (FLIP animation for smooth reordering)
 * - Row highlight (amber flash on any bar that changed)
 * - "Last updated" relative timestamp
 *
 * Reconnects with exponential backoff (1s → 30s max).
 */
(function () {
  'use strict';

  var config = window.__RESULTS_CONFIG__;
  if (!config || !config.meetingId) return;

  // Only connect SSE when voting is open (live updates matter)
  if (!config.isVotingOpen) return;

  var chart       = document.getElementById('results-chart');
  var voteCountEl = document.getElementById('results-vote-count');
  var updatedEl   = document.getElementById('results-last-updated');

  if (!chart) return;

  var baseDelay    = 1000;
  var maxDelay     = 30000;
  var delay        = baseDelay;
  var es           = null;
  var lastUpdateTs = Date.now();
  var isFirstMessage = true;

  // ── "Last updated" ticker ──────────────────────────────────
  function formatRelativeTime(ms) {
    var seconds = Math.floor(ms / 1000);
    if (seconds < 5)  return 'just now';
    if (seconds < 60) return seconds + ' seconds ago';
    var minutes = Math.floor(seconds / 60);
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60)  return minutes + ' minutes ago';
    var hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return hours + ' hours ago';
  }

  function tickUpdatedLabel() {
    if (!updatedEl) return;
    var elapsed = Date.now() - lastUpdateTs;
    updatedEl.textContent = 'Last updated ' + formatRelativeTime(elapsed);
  }

  // Tick every 5 seconds to keep the label fresh
  setInterval(tickUpdatedLabel, 5000);

  // ── SSE connection ─────────────────────────────────────────
  function connect() {
    es = new EventSource('/api/meetings/' + config.meetingId + '/results/stream');

    es.onopen = function () {
      delay = baseDelay;
    };

    es.onmessage = function (e) {
      try {
        var data = JSON.parse(e.data);
        updateResults(data);
      } catch (err) {
        // Ignore malformed messages
      }
    };

    es.onerror = function () {
      es.close();
      setTimeout(connect, delay);
      delay = Math.min(delay * 2, maxDelay);
    };
  }

  // ── FLIP animation helper ──────────────────────────────────
  function flipReorder(rankings) {
    var bars = chart.querySelectorAll('.results-bar');
    var firstPositions = {};

    // FIRST: record current Y positions
    for (var i = 0; i < bars.length; i++) {
      firstPositions[bars[i].dataset.bookId] = bars[i].getBoundingClientRect().top;
    }

    // Reorder DOM to match new ranking
    rankings.forEach(function (r) {
      var bar = chart.querySelector('.results-bar[data-book-id="' + r.book_id + '"]');
      if (bar) chart.appendChild(bar);
    });

    // INVERT + PLAY
    var reorderedBars = chart.querySelectorAll('.results-bar');
    for (var j = 0; j < reorderedBars.length; j++) {
      var bar = reorderedBars[j];
      var id = bar.dataset.bookId;
      if (!(id in firstPositions)) continue;

      var deltaY = firstPositions[id] - bar.getBoundingClientRect().top;
      if (Math.abs(deltaY) < 1) continue;

      bar.style.transform = 'translateY(' + deltaY + 'px)';
      bar.style.transition = 'none';
      bar.offsetHeight; // force reflow

      bar.style.transition = 'transform 800ms cubic-bezier(0.22, 1, 0.36, 1)';
      bar.style.transform = 'translateY(0)';

      // Clean up inline styles after animation
      (function (el) {
        function onEnd() {
          el.style.transform = '';
          el.style.transition = '';
          el.removeEventListener('transitionend', onEnd);
        }
        el.addEventListener('transitionend', onEnd);
      })(bar);
    }
  }

  // ── Animate helper: add class, remove after duration ─────
  // Uses setTimeout for cleanup (animationend can be unreliable
  // in some browser contexts).
  var ANIM_DURATIONS = { 'is-pop': 1100, 'is-updated': 2100 };

  function animateClass(el, className) {
    el.classList.remove(className);
    el.offsetHeight; // force reflow to restart
    el.classList.add(className);

    var dur = ANIM_DURATIONS[className] || 800;
    setTimeout(function () {
      el.classList.remove(className);
    }, dur);
  }

  // ── Main update ────────────────────────────────────────────
  function updateResults(data) {
    // Update timestamp
    lastUpdateTs = Date.now();
    tickUpdatedLabel();

    // Skip animations on the very first SSE message (initial state)
    var shouldAnimate = !isFirstMessage;
    isFirstMessage = false;

    // Update vote count
    if (voteCountEl) {
      var oldCount = voteCountEl.textContent.trim();
      var newCount = String(data.voteCount);
      if (oldCount !== newCount) {
        voteCountEl.textContent = newCount;
        if (shouldAnimate) animateClass(voteCountEl, 'is-pop');
      }
    }

    var rankings = data.rankings || [];

    // Update each bar's data
    rankings.forEach(function (r) {
      var bar = chart.querySelector('.results-bar[data-book-id="' + r.book_id + '"]');
      if (!bar) return;

      var changed = false;

      // Update fill width (CSS transition on .results-bar__fill handles the smooth grow)
      var fill = bar.querySelector('.results-bar__fill');
      if (fill) {
        var oldPct = fill.dataset.pct;
        var newPct = String(r.pct);
        if (oldPct !== newPct) {
          fill.style.width = r.pct + '%';
          fill.dataset.pct = r.pct;
          changed = true;
        }
      }

      // Update points label
      var pts = bar.querySelector('.results-bar__points');
      if (pts) {
        var newText = r.points + ' pt' + (r.points === 1 ? '' : 's');
        if (pts.textContent.trim() !== newText) {
          pts.textContent = newText;
          pts.dataset.points = r.points;
          changed = true;
          if (shouldAnimate) animateClass(pts, 'is-pop');
        }
      }

      // Highlight the whole row if anything changed
      if (changed && shouldAnimate) {
        animateClass(bar, 'is-updated');
      }
    });

    // Reorder bars with FLIP animation (only if not first message)
    if (shouldAnimate) {
      flipReorder(rankings);
    } else {
      // Still reorder, just without animation
      rankings.forEach(function (r) {
        var bar = chart.querySelector('.results-bar[data-book-id="' + r.book_id + '"]');
        if (bar) chart.appendChild(bar);
      });
    }
  }

  connect();
})();
