/**
 * home-live.js — SSE client for live home page updates.
 *
 * Connects to /api/home/stream and updates:
 * - Announcements banner (full replacement)
 * - Activity feed (full replacement with entrance animation)
 *
 * Reconnects with exponential backoff (1s → 30s max).
 */
(function () {
  'use strict';

  var config = window.__HOME_CONFIG__;
  if (!config) return;

  var announcementsEl = document.getElementById('home-announcements');
  var activityList    = document.getElementById('home-activity-list');

  var baseDelay = 1000;
  var maxDelay  = 30000;
  var delay     = baseDelay;
  var es               = null;
  var isFirstAnnounce  = true;
  var isFirstActivity  = true;

  // Tier helper — returns BEM modifier class (e.g. "grade-badge--a")
  function gradeTier(grade) {
    if (!grade) return '';
    return 'grade-badge--' + grade.charAt(0).toLowerCase();
  }

  // ── Announcement type → SVG icon ─────────────────────────
  var ICONS = {
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    info:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  // ── Month names for formatting ──────────────────────────
  var MONTH_FULL = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function formatMonthYear(my) {
    if (!my) return '';
    var parts = my.split('-');
    var idx = parseInt(parts[1], 10) - 1;
    return (MONTH_FULL[idx] || parts[1]) + ' ' + parts[0];
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    var ts = Date.parse(dateStr.replace(' ', 'T') + 'Z');
    if (isNaN(ts)) return '';
    var seconds = Math.floor((Date.now() - ts) / 1000);

    if (seconds < 60)    return 'just now';
    if (seconds < 3600)  return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';

    var d = new Date(ts);
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate();
  }

  // ── Escape HTML ──────────────────────────────────────────
  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ── Render announcements ─────────────────────────────────
  function renderAnnouncements(list) {
    if (!announcementsEl) return;

    if (!list || list.length === 0) {
      announcementsEl.innerHTML = '';
      announcementsEl.hidden = true;
      return;
    }

    announcementsEl.hidden = false;
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var type = a.type || 'info';
      var icon = ICONS[type] || ICONS.info;
      html += '<div class="announcement announcement--' + esc(type) + '">'
        + '<div class="announcement__icon">' + icon + '</div>'
        + '<div class="announcement__content">'
        + '<strong class="announcement__title">' + esc(a.title) + '</strong>';
      if (a.body) {
        html += '<p class="announcement__body">' + esc(a.body) + '</p>';
      }
      html += '</div></div>';
    }
    announcementsEl.innerHTML = html;
  }

  // ── Avatar HTML helper ───────────────────────────────────
  function avatarHtml(item) {
    var name = item.actor_name || item.actor_email || '?';
    var style = item.actor_avatar || 'initials';

    if (style === 'initials') {
      var words = name.trim().split(/\s+/);
      var initials = words.length >= 2
        ? words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase()
        : words[0].charAt(0).toUpperCase();
      return '<span class="avatar avatar--sm activity-item__avatar">' + esc(initials) + '</span>';
    }

    return '<img class="avatar avatar--sm activity-item__avatar"'
      + ' src="https://api.dicebear.com/9.x/' + encodeURIComponent(style) + '/svg?seed=' + encodeURIComponent(name) + '"'
      + ' alt="' + esc(name) + '" loading="lazy">';
  }

  // ── Render a single activity item HTML ───────────────────
  function activityItemHtml(item) {
    var actorName = item.actor_name || item.actor_email || 'Someone';
    var bookHref = '/books/' + item.author_slug + '/' + item.title_slug;
    var actorLink = item.actor_slug
      ? '<a href="/members/' + esc(item.actor_slug) + '" class="activity-item__actor">' + esc(actorName) + '</a>'
      : '<strong class="activity-item__actor">' + esc(actorName) + '</strong>';

    var text = actorLink + ' ';

    if (item.type === 'review') {
      text += 'reviewed <a href="' + esc(bookHref) + '" class="activity-item__book">' + esc(item.book_title) + '</a>';
      if (item.grade) {
        text += ' <span class="grade-badge grade-badge--xs ' + gradeTier(item.grade) + '">' + esc(item.grade) + '</span>';
      }
    } else if (item.type === 'reply') {
      var target = item.target_slug
        ? '<a href="/members/' + esc(item.target_slug) + '" class="activity-item__target">' + esc(item.target_name || 'someone') + '</a>'
        : '<strong>' + esc(item.target_name || 'someone') + '</strong>';
      text += 'replied to ' + target + '\'s review of <a href="' + esc(bookHref) + '" class="activity-item__book">' + esc(item.book_title) + '</a>';
    } else if (item.type === 'reaction') {
      var rTarget = item.target_slug
        ? '<a href="/members/' + esc(item.target_slug) + '" class="activity-item__target">' + esc(item.target_name || 'someone') + '</a>'
        : '<strong>' + esc(item.target_name || 'someone') + '</strong>';
      text += 'reacted <span class="activity-item__emoji">' + esc(item.emoji) + '</span> to ' + rTarget + '\'s review of <a href="' + esc(bookHref) + '" class="activity-item__book">' + esc(item.book_title) + '</a>';
    } else if (item.type === 'nomination') {
      text += 'nominated <a href="' + esc(bookHref) + '" class="activity-item__book">' + esc(item.book_title) + '</a>';
      if (item.meeting_month_year) {
        text += ' for <strong>' + esc(formatMonthYear(item.meeting_month_year)) + '</strong>';
      }
    }

    return '<li class="activity-item activity-item--' + item.type + '">'
      + avatarHtml(item)
      + '<div class="activity-item__body">'
      + '<p class="activity-item__text">' + text + '</p>'
      + '<time class="activity-item__time t-caption text-tertiary">' + timeAgo(item.created_at) + '</time>'
      + '</div></li>';
  }

  // ── Render activity feed ─────────────────────────────────
  function renderActivity(list) {
    if (!activityList) return;

    var section = document.getElementById('home-activity-section');

    if (!list || list.length === 0) {
      activityList.innerHTML = '';
      if (section) section.hidden = true;
      return;
    }

    if (section) section.hidden = false;

    var html = '';
    for (var i = 0; i < list.length; i++) {
      html += activityItemHtml(list[i]);
    }
    activityList.innerHTML = html;
  }

  // ── SSE connection ───────────────────────────────────────
  function connect() {
    es = new EventSource('/api/home/stream');

    es.onopen = function () {
      delay = baseDelay;
    };

    es.addEventListener('announcements', function (e) {
      try {
        var data = JSON.parse(e.data);
        if (isFirstAnnounce) { isFirstAnnounce = false; return; }
        renderAnnouncements(data);
      } catch (err) {}
    });

    es.addEventListener('activity', function (e) {
      try {
        var data = JSON.parse(e.data);
        if (isFirstActivity) { isFirstActivity = false; return; }
        renderActivity(data);
      } catch (err) {}
    });

    es.onerror = function () {
      es.close();
      isFirstAnnounce = true;
      isFirstActivity = true;
      setTimeout(connect, delay);
      delay = Math.min(delay * 2, maxDelay);
    };
  }

  connect();
})();
