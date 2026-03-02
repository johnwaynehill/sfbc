/**
 * Emoji Reactions — picker popover + optimistic toggle
 * Loaded globally in app-shell.ejs; works on book-detail and member-profile.
 */
(function () {
  'use strict';

  // ---- Curated emoji grid ----
  var EMOJI_GRID = [
    // Faces
    '\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F525}', '\u{1F60D}', '\u{1F602}',
    '\u{1F622}', '\u{1F62E}', '\u{1F914}', '\u{1F92F}', '\u{1F971}',
    // Hands & gestures
    '\u{1F44F}', '\u{1F64C}', '\u{1F4AF}', '\u{270C}\u{FE0F}', '\u{1F91D}',
    // Books & reading
    '\u{1F4DA}', '\u{1F4D6}', '\u{1F4D6}', '\u{2728}', '\u{1F3C6}',
    // Symbols & misc
    '\u{1F4A1}', '\u{1F389}', '\u{1F31F}', '\u{1F4A9}', '\u{1F480}',
    '\u{1F648}', '\u{1F62D}', '\u{1F60E}', '\u{1F913}', '\u{1F47B}',
  ];

  // Deduplicate (the two 📖 above are intentional duplication, fix)
  EMOJI_GRID = EMOJI_GRID.filter(function (e, i) { return EMOJI_GRID.indexOf(e) === i; });

  // Extended set for search
  var EMOJI_ALL = [
    { e: '\u{1F44D}', k: 'thumbs up good yes like' },
    { e: '\u{1F44E}', k: 'thumbs down bad no dislike' },
    { e: '\u{2764}\u{FE0F}', k: 'heart love' },
    { e: '\u{1F525}', k: 'fire hot lit' },
    { e: '\u{1F60D}', k: 'love heart eyes' },
    { e: '\u{1F602}', k: 'laugh cry tears joy funny' },
    { e: '\u{1F622}', k: 'cry sad tears' },
    { e: '\u{1F62D}', k: 'crying loud sob' },
    { e: '\u{1F62E}', k: 'wow surprised open mouth' },
    { e: '\u{1F914}', k: 'think hmm wondering' },
    { e: '\u{1F92F}', k: 'mind blown explode' },
    { e: '\u{1F971}', k: 'bored yawn' },
    { e: '\u{1F44F}', k: 'clap applause bravo' },
    { e: '\u{1F64C}', k: 'raised hands celebrate praise' },
    { e: '\u{1F4AF}', k: 'hundred perfect score' },
    { e: '\u{270C}\u{FE0F}', k: 'peace victory' },
    { e: '\u{1F91D}', k: 'handshake agree' },
    { e: '\u{1F4DA}', k: 'books stack reading' },
    { e: '\u{1F4D6}', k: 'book open reading' },
    { e: '\u{2728}', k: 'sparkles magic star' },
    { e: '\u{1F3C6}', k: 'trophy winner award' },
    { e: '\u{1F4A1}', k: 'light bulb idea' },
    { e: '\u{1F389}', k: 'party confetti celebrate' },
    { e: '\u{1F31F}', k: 'star glowing bright' },
    { e: '\u{1F4A9}', k: 'poop' },
    { e: '\u{1F480}', k: 'skull dead' },
    { e: '\u{1F648}', k: 'see no evil monkey' },
    { e: '\u{1F60E}', k: 'cool sunglasses' },
    { e: '\u{1F913}', k: 'nerd glasses geek' },
    { e: '\u{1F47B}', k: 'ghost spooky' },
    { e: '\u{1F4AA}', k: 'strong muscle flex' },
    { e: '\u{1F496}', k: 'sparkling heart love' },
    { e: '\u{1F49C}', k: 'purple heart love' },
    { e: '\u{1F62C}', k: 'grimace cringe awkward' },
    { e: '\u{1F610}', k: 'neutral meh' },
    { e: '\u{1F634}', k: 'sleeping zzz boring' },
    { e: '\u{1F923}', k: 'rofl laughing rolling' },
    { e: '\u{1F97A}', k: 'pleading puppy eyes' },
    { e: '\u{1F4D5}', k: 'book closed red' },
    { e: '\u{1F4DD}', k: 'memo write note' },
    { e: '\u{1F3AD}', k: 'theater arts drama masks' },
    { e: '\u{1F30D}', k: 'globe world earth' },
    { e: '\u{1F52E}', k: 'crystal ball magic' },
    { e: '\u{1F9E0}', k: 'brain smart think' },
    { e: '\u{1FAE0}', k: 'melting face' },
    { e: '\u{1F92E}', k: 'vomit sick disgusting' },
    { e: '\u{1F976}', k: 'cold freezing ice' },
    { e: '\u{1F975}', k: 'hot warm sweating' },
  ];

  var activePicker = null;
  var activeTooltip = null;
  var tooltipCache = {};    // key: "reviewId:emoji" → { users, ts }
  var hoverTimer = null;
  var hoveredPill = null;
  var TOOLTIP_DELAY = 400;  // ms before showing
  var CACHE_TTL = 30000;    // 30s cache

  // ---- Reactor tooltip ----

  function reactorCacheKey(reviewId, emoji) {
    return reviewId + ':' + emoji;
  }

  function invalidateReactorCache(reviewId, emoji) {
    delete tooltipCache[reactorCacheKey(reviewId, emoji)];
  }

  function hideTooltip() {
    clearTimeout(hoverTimer);
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  function showReactorTooltip(pill, reviewId, emoji) {
    hideTooltip();

    var key = reactorCacheKey(reviewId, emoji);
    var cached = tooltipCache[key];

    if (cached && (Date.now() - cached.ts < CACHE_TTL)) {
      renderTooltip(pill, cached.users, emoji);
      return;
    }

    // Fetch from API
    fetch('/api/reviews/' + reviewId + '/reactions/' + encodeURIComponent(emoji))
      .then(function (res) { return res.json(); })
      .then(function (users) {
        tooltipCache[key] = { users: users, ts: Date.now() };
        // Only render if we're still hovering the same pill
        if (hoveredPill === pill) {
          renderTooltip(pill, users, emoji);
        }
      })
      .catch(function () { /* silent */ });
  }

  function renderTooltip(pill, users, emoji) {
    if (!users || users.length === 0) return;
    hideTooltip();

    var tip = document.createElement('div');
    tip.className = 'reactor-tooltip';
    tip.setAttribute('role', 'tooltip');

    // Build name list (max 8 shown, "+N more" for overflow)
    var MAX_SHOW = 8;
    var names = [];
    for (var i = 0; i < Math.min(users.length, MAX_SHOW); i++) {
      names.push(escapeHtml(users[i].display_name));
    }
    var nameStr = names.join(', ');
    if (users.length > MAX_SHOW) {
      nameStr += ' +' + (users.length - MAX_SHOW) + ' more';
    }

    tip.innerHTML =
      '<span class="reactor-tooltip__emoji">' + emoji + '</span>' +
      '<span class="reactor-tooltip__names">' + nameStr + '</span>';

    // Position above the pill
    var bar = pill.closest('.reaction-bar');
    bar.appendChild(tip);

    // Adjust position if off-screen
    requestAnimationFrame(function () {
      var tipRect = tip.getBoundingClientRect();
      var pillRect = pill.getBoundingClientRect();
      var barRect = bar.getBoundingClientRect();

      // Center the tooltip on the pill
      var pillCenter = pillRect.left + pillRect.width / 2 - barRect.left;
      var tipHalfWidth = tip.offsetWidth / 2;
      var left = pillCenter - tipHalfWidth;

      // Clamp to not overflow viewport
      var maxLeft = window.innerWidth - barRect.left - tip.offsetWidth - 8;
      left = Math.max(0, Math.min(left, maxLeft));
      tip.style.left = left + 'px';

      // Position above the pill
      var bottom = barRect.bottom - pillRect.top + 6;
      tip.style.bottom = bottom + 'px';
    });

    activeTooltip = tip;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- Helpers ----

  function createPicker(reviewId, anchorEl) {
    // Close any existing picker
    closePicker();

    var picker = document.createElement('div');
    picker.className = 'emoji-picker';
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-label', 'Choose an emoji');

    // Search input
    var search = document.createElement('input');
    search.type = 'text';
    search.className = 'emoji-picker__search';
    search.placeholder = 'Search emoji\u2026';
    search.setAttribute('autocomplete', 'off');
    picker.appendChild(search);

    // Grid container
    var grid = document.createElement('div');
    grid.className = 'emoji-picker__grid';
    picker.appendChild(grid);

    function renderGrid(filter) {
      grid.innerHTML = '';
      var list = filter ? EMOJI_ALL.filter(function (item) {
        return item.k.indexOf(filter.toLowerCase()) !== -1;
      }) : EMOJI_ALL.slice(0, EMOJI_GRID.length);

      if (list.length === 0) {
        var empty = document.createElement('span');
        empty.className = 'emoji-picker__empty';
        empty.textContent = 'No results';
        grid.appendChild(empty);
        return;
      }

      list.forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-picker__btn';
        btn.textContent = item.e;
        btn.setAttribute('aria-label', item.k.split(' ')[0]);
        btn.addEventListener('click', function () {
          closePicker();
          toggleReaction(reviewId, item.e);
        });
        grid.appendChild(btn);
      });
    }

    renderGrid(null);

    search.addEventListener('input', function () {
      renderGrid(search.value.trim());
    });

    // Position: place below the anchor button
    anchorEl.parentNode.style.position = 'relative';
    anchorEl.parentNode.appendChild(picker);

    // Focus search
    requestAnimationFrame(function () {
      search.focus();
      // Reposition if off-screen to the right
      var rect = picker.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) {
        picker.style.right = '0';
        picker.style.left = 'auto';
      }
    });

    activePicker = picker;

    // Close on outside click (after a small delay to avoid the triggering click)
    setTimeout(function () {
      document.addEventListener('click', onOutsideClick);
      document.addEventListener('keydown', onEscape);
    }, 0);
  }

  function closePicker() {
    if (activePicker) {
      activePicker.remove();
      activePicker = null;
    }
    document.removeEventListener('click', onOutsideClick);
    document.removeEventListener('keydown', onEscape);
  }

  function onOutsideClick(e) {
    if (activePicker && !activePicker.contains(e.target) && !e.target.closest('.reaction-add')) {
      closePicker();
    }
  }

  function onEscape(e) {
    if (e.key === 'Escape') closePicker();
  }

  // ---- Toggle reaction (optimistic) ----

  function toggleReaction(reviewId, emoji) {
    hideTooltip();
    invalidateReactorCache(reviewId, emoji);

    var bar = document.querySelector('.reaction-bar[data-review-id="' + reviewId + '"]');
    if (!bar) return;

    // Find existing pill for this emoji
    var pill = bar.querySelector('.reaction-pill[data-emoji="' + CSS.escape(emoji) + '"]');
    var wasActive = pill && pill.classList.contains('is-active');

    // Optimistic update
    if (pill) {
      var countEl = pill.querySelector('.reaction-pill__count');
      var count = parseInt(countEl.textContent, 10);
      if (wasActive) {
        count--;
        pill.classList.remove('is-active');
        if (count <= 0) {
          pill.remove();
        } else {
          countEl.textContent = count;
        }
      } else {
        count++;
        pill.classList.add('is-active');
        countEl.textContent = count;
      }
    } else {
      // Create a new pill
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'reaction-pill is-active';
      pill.setAttribute('data-emoji', emoji);
      pill.setAttribute('aria-label', emoji + ' (1)');
      pill.innerHTML = '<span class="reaction-pill__emoji">' + emoji + '</span><span class="reaction-pill__count">1</span>';
      // Insert before the add button
      var addBtn = bar.querySelector('.reaction-add');
      if (addBtn) {
        bar.insertBefore(pill, addBtn);
      } else {
        bar.appendChild(pill);
      }
    }

    // Server request
    fetch('/api/reviews/' + reviewId + '/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: emoji }),
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      // Reconcile with server truth
      var currentPill = bar.querySelector('.reaction-pill[data-emoji="' + CSS.escape(emoji) + '"]');
      if (data.count === 0 && currentPill) {
        currentPill.remove();
      } else if (data.count > 0 && currentPill) {
        currentPill.querySelector('.reaction-pill__count').textContent = data.count;
        currentPill.classList.toggle('is-active', data.added);
      }
    })
    .catch(function () {
      // Revert on network error — just reload to be safe
    });
  }

  // ---- Event delegation ----

  document.addEventListener('click', function (e) {
    // Toggle existing reaction pill
    var pill = e.target.closest('.reaction-pill');
    if (pill && !pill.disabled) {
      var bar = pill.closest('.reaction-bar');
      var reviewId = bar && bar.dataset.reviewId;
      var emoji = pill.dataset.emoji;
      if (reviewId && emoji) {
        toggleReaction(parseInt(reviewId, 10), emoji);
      }
      return;
    }

    // Open picker
    var addBtn = e.target.closest('.reaction-add');
    if (addBtn) {
      e.stopPropagation();
      var bar2 = addBtn.closest('.reaction-bar');
      var rid = bar2 && bar2.dataset.reviewId;
      if (rid) {
        if (activePicker && activePicker.parentNode === bar2) {
          closePicker();
        } else {
          createPicker(parseInt(rid, 10), addBtn);
        }
      }
    }
  });

  // ---- Reactor tooltip on hover ----

  document.addEventListener('mouseover', function (e) {
    var pill = e.target.closest('.reaction-pill');
    if (!pill || pill === hoveredPill) return;
    hoveredPill = pill;

    var bar = pill.closest('.reaction-bar');
    if (!bar) return;
    var reviewId = bar.dataset.reviewId;
    var emoji = pill.dataset.emoji;
    if (!reviewId || !emoji) return;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      showReactorTooltip(pill, parseInt(reviewId, 10), emoji);
    }, TOOLTIP_DELAY);
  });

  document.addEventListener('mouseout', function (e) {
    var pill = e.target.closest('.reaction-pill');
    if (!pill) return;
    // Only hide if we're actually leaving the pill (not moving to a child)
    var related = e.relatedTarget;
    if (related && pill.contains(related)) return;
    hoveredPill = null;
    hideTooltip();
  });

  // Hide tooltip on scroll (prevents stale position)
  document.addEventListener('scroll', hideTooltip, true);
})();
