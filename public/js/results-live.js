/**
 * results-live.js — SSE client for real-time results updates.
 *
 * Connects to /api/meetings/:meetingId/results/stream and updates:
 * - Bar widths (CSS transition handles animation)
 * - Points labels
 * - Vote count
 * - Bar order (reorder on rank change)
 *
 * Reconnects with exponential backoff (1s → 30s max).
 */
(function () {
  'use strict';

  var config = window.__RESULTS_CONFIG__;
  if (!config || !config.meetingId) return;

  // Only connect SSE when voting is open (live updates matter)
  if (!config.isVotingOpen) return;

  var chart        = document.getElementById('results-chart');
  var resultsList  = document.getElementById('results-list');
  var voteCountEl  = document.getElementById('results-vote-count');

  if (!chart) return;

  var baseDelay = 1000;
  var maxDelay  = 30000;
  var delay     = baseDelay;
  var es        = null;

  function connect() {
    es = new EventSource('/api/meetings/' + config.meetingId + '/results/stream');

    es.onopen = function () {
      delay = baseDelay; // reset on successful connect
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
      // Exponential backoff
      setTimeout(connect, delay);
      delay = Math.min(delay * 2, maxDelay);
    };
  }

  function updateResults(data) {
    // Update vote count
    if (voteCountEl) {
      voteCountEl.textContent = data.voteCount;
    }

    var rankings = data.rankings || [];

    // Update bar chart
    rankings.forEach(function (r) {
      var bar = chart.querySelector('.results-bar[data-book-id="' + r.book_id + '"]');
      if (!bar) return;

      // Update fill width
      var fill = bar.querySelector('.results-bar__fill');
      if (fill) {
        fill.style.width = r.pct + '%';
        fill.dataset.pct = r.pct;
      }

      // Update points label
      var pts = bar.querySelector('.results-bar__points');
      if (pts) {
        pts.textContent = r.points + ' pt' + (r.points === 1 ? '' : 's');
        pts.dataset.points = r.points;
      }
    });

    // Reorder bars to match new ranking
    rankings.forEach(function (r) {
      var bar = chart.querySelector('.results-bar[data-book-id="' + r.book_id + '"]');
      if (bar) {
        chart.appendChild(bar);
      }
    });

    // Update ranked list
    if (resultsList) {
      rankings.forEach(function (r) {
        var item = resultsList.querySelector('.results-item[data-book-id="' + r.book_id + '"]');
        if (!item) return;

        var rankEl = item.querySelector('.results-item__rank');
        if (rankEl) rankEl.textContent = '#' + r.rank;

        var ptsEl = item.querySelector('.results-item__points');
        if (ptsEl) ptsEl.textContent = r.points + ' pt' + (r.points === 1 ? '' : 's');

        resultsList.appendChild(item);
      });
    }
  }

  connect();
})();
