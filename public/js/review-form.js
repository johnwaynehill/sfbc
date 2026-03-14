/**
 * review-form.js — Grade picker, markdown toolbar, auto-save, char count,
 *                  live preview, and form submission.
 */
(function () {
  'use strict';

  var form = document.getElementById('review-form');
  if (!form) return;

  var bookId = form.dataset.bookId;
  var STORAGE_KEY = 'review-draft-' + bookId;
  var MAX_CHARS = 10000;

  // ---- DOM refs ----
  var gradeInput  = document.getElementById('grade-input');
  var display     = document.getElementById('grade-display');
  var strip       = document.getElementById('grade-strip');
  var textarea    = document.getElementById('review-body');
  var charCount   = document.getElementById('char-count');
  var previewPane = document.getElementById('review-preview');
  var previewBtn  = document.getElementById('toolbar-preview');
  var spoilerCb   = document.getElementById('has-spoilers');
  var didFinishCb = document.getElementById('did-finish');
  var submitBtn   = document.getElementById('review-submit');
  var messageEl   = document.getElementById('review-message');
  var methodField = form.querySelector('[name="_method"]');
  var isPut       = methodField && methodField.value === 'PUT';

  // ===========================================================================
  // Grade Picker
  // ===========================================================================
  var TIER_COLORS = {
    f:  { bg: 'linear-gradient(135deg, #FEF2F2, #FECACA)', text: '#991B1B', border: '#FECACA', darkBg: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.08))', darkText: '#f87171', darkBorder: 'rgba(239,68,68,0.3)' },
    d:  { bg: 'linear-gradient(135deg, #FFF7ED, #FED7AA)', text: '#9A3412', border: '#FED7AA', darkBg: 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(249,115,22,0.08))', darkText: '#fb923c', darkBorder: 'rgba(249,115,22,0.3)' },
    c:  { bg: 'linear-gradient(135deg, #F5F5F4, #E7E5E4)', text: '#57534E', border: '#D6D3D1', darkBg: 'linear-gradient(135deg, rgba(168,162,158,0.15), rgba(168,162,158,0.06))', darkText: '#a8a29e', darkBorder: 'rgba(168,162,158,0.3)' },
    b:  { bg: 'linear-gradient(135deg, #EFF6FF, #BFDBFE)', text: '#1E3A5F', border: '#93C5FD', darkBg: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(59,130,246,0.08))', darkText: '#60a5fa', darkBorder: 'rgba(59,130,246,0.3)' },
    a:  { bg: 'linear-gradient(135deg, #ECFDF5, #A7F3D0)', text: '#065F46', border: '#6EE7B7', darkBg: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08))', darkText: '#4ade80', darkBorder: 'rgba(34,197,94,0.3)' },
    s:  { bg: 'linear-gradient(135deg, #FEF3C7, #FDE68A, #FCD34D)', text: '#78350F', border: '#FCD34D', darkBg: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(245,158,11,0.08))', darkText: '#fbbf24', darkBorder: 'rgba(245,158,11,0.35)' },
  };

  function getTier(grade) {
    if (!grade) return null;
    return grade.charAt(0).toLowerCase();
  }

  function isDark() {
    var theme = document.documentElement.getAttribute('data-theme');
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function updateDisplay(grade) {
    var tier = getTier(grade);
    var colors = tier ? TIER_COLORS[tier] : null;
    var dark = isDark();

    display.textContent = grade || '\u2014';

    if (colors) {
      display.style.background = dark ? colors.darkBg : colors.bg;
      display.style.color = dark ? colors.darkText : colors.text;
      display.style.boxShadow = tier === 's'
        ? (dark ? '0 2px 12px rgba(245,158,11,0.15)' : '0 2px 12px rgba(245,158,11,0.2)')
        : 'none';
    } else {
      display.style.background = 'var(--surface)';
      display.style.color = 'var(--text3)';
      display.style.boxShadow = 'none';
    }
  }

  function selectGrade(grade) {
    hasInteracted = true;
    gradeInput.value = grade;
    updateDisplay(grade);

    var dark = isDark();
    var pills = strip.querySelectorAll('.grade-pill');
    for (var i = 0; i < pills.length; i++) {
      var pill = pills[i];
      var g = pill.getAttribute('data-grade');
      var isSelected = g === grade;
      pill.classList.toggle('is-selected', isSelected);

      if (isSelected) {
        var colors = TIER_COLORS[getTier(g)];
        pill.style.background = dark ? colors.darkBg : colors.bg;
        pill.style.color = dark ? colors.darkText : colors.text;
        pill.style.borderColor = dark ? colors.darkBorder : colors.border;
      } else {
        pill.style.background = '';
        pill.style.color = '';
        pill.style.borderColor = '';
      }
    }
    saveDraft();
  }

  strip.addEventListener('click', function (e) {
    var pill = e.target.closest('.grade-pill');
    if (!pill) return;
    selectGrade(pill.getAttribute('data-grade'));
    pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });

  // ===========================================================================
  // Character count
  // ===========================================================================
  function updateCharCount() {
    var len = textarea.value.length;
    charCount.textContent = len.toLocaleString() + ' / ' + MAX_CHARS.toLocaleString();
    charCount.classList.toggle('char-count--warn', len > MAX_CHARS * 0.9);
    charCount.classList.toggle('char-count--over', len > MAX_CHARS);
  }

  textarea.addEventListener('input', function () {
    updateCharCount();
    saveDraft();
    // Exit preview mode on edit
    if (isPreviewMode) togglePreview();
  });

  updateCharCount();

  // ===========================================================================
  // Markdown toolbar
  // ===========================================================================
  var toolbar = document.getElementById('md-toolbar');
  if (toolbar) {
    toolbar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;

      var action = btn.dataset.action;
      if (action === 'preview') {
        togglePreview();
        return;
      }

      applyFormat(action);
      textarea.focus();
    });
  }

  function applyFormat(action) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var text = textarea.value;
    var selected = text.slice(start, end);
    var before = text.slice(0, start);
    var after = text.slice(end);
    var replacement, cursorOffset;

    switch (action) {
      case 'bold':
        replacement = '**' + (selected || 'bold text') + '**';
        cursorOffset = selected ? replacement.length : 2;
        break;
      case 'italic':
        replacement = '*' + (selected || 'italic text') + '*';
        cursorOffset = selected ? replacement.length : 1;
        break;
      case 'list':
        // Put each line on a bullet, or start a new bullet
        if (selected) {
          replacement = selected.split('\n').map(function (l) { return '- ' + l; }).join('\n');
        } else {
          replacement = '- ';
        }
        cursorOffset = replacement.length;
        break;
      case 'quote':
        if (selected) {
          replacement = selected.split('\n').map(function (l) { return '> ' + l; }).join('\n');
        } else {
          replacement = '> ';
        }
        cursorOffset = replacement.length;
        break;
      case 'spoiler':
        replacement = '||' + (selected || 'spoiler text') + '||';
        cursorOffset = selected ? replacement.length : 2;
        break;
      case 'link':
        if (selected) {
          replacement = '[' + selected + '](url)';
          cursorOffset = replacement.length - 1; // place cursor before closing )
        } else {
          replacement = '[link text](url)';
          cursorOffset = 1; // place cursor after [
        }
        break;
      case 'strikethrough':
        replacement = '~~' + (selected || 'strikethrough text') + '~~';
        cursorOffset = selected ? replacement.length : 2;
        break;
      case 'heading':
        replacement = '### ' + (selected || 'Heading');
        cursorOffset = selected ? replacement.length : 4;
        break;
      case 'ordered-list':
        if (selected) {
          replacement = selected.split('\n').map(function (l, i) { return (i + 1) + '. ' + l; }).join('\n');
        } else {
          replacement = '1. ';
        }
        cursorOffset = replacement.length;
        break;
      default:
        return;
    }

    textarea.value = before + replacement + after;
    // Set cursor position
    var newPos = start + cursorOffset;
    textarea.setSelectionRange(newPos, newPos);
    updateCharCount();
    saveDraft();
  }

  // ===========================================================================
  // Live preview
  // ===========================================================================
  var isPreviewMode = false;

  function togglePreview() {
    isPreviewMode = !isPreviewMode;

    if (isPreviewMode) {
      var html = clientRenderMarkdown(textarea.value);
      previewPane.innerHTML = html || '<p class="text-secondary">Nothing to preview</p>';
      previewPane.hidden = false;
      textarea.hidden = true;
      if (previewBtn) {
        previewBtn.textContent = 'Write';
        previewBtn.classList.add('is-active');
      }
    } else {
      previewPane.hidden = true;
      textarea.hidden = false;
      if (previewBtn) {
        previewBtn.textContent = 'Preview';
        previewBtn.classList.remove('is-active');
      }
    }
  }

  /**
   * Lightweight client-side markdown → HTML for preview.
   * Covers: bold, italic, lists, blockquotes, spoilers, links, line breaks.
   * Actual rendering uses server-side marked + DOMPurify on save.
   */
  function clientRenderMarkdown(text) {
    if (!text) return '';

    // Escape HTML
    var html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Spoiler: ||text||
    html = html.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>');

    // Strikethrough: ~~text~~
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Bold: **text** or __text__
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic: *text* or _text_
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Process line by line for block elements
    var lines = html.split('\n');
    var result = [];
    var inList = false;
    var inOl = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // Headings: ### text
      if (/^#{1,3}\s+/.test(line)) {
        if (inList) { result.push('</ul>'); inList = false; }
        if (inOl) { result.push('</ol>'); inOl = false; }
        var level = line.match(/^(#{1,3})/)[1].length;
        result.push('<h' + level + '>' + line.replace(/^#{1,3}\s+/, '') + '</h' + level + '>');
        continue;
      }

      // Unordered list
      if (/^[-*+]\s+/.test(line)) {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (!inList) { result.push('<ul>'); inList = true; }
        result.push('<li>' + line.replace(/^[-*+]\s+/, '') + '</li>');
        continue;
      }

      // Ordered list
      if (/^\d+\.\s+/.test(line)) {
        if (inList) { result.push('</ul>'); inList = false; }
        if (!inOl) { result.push('<ol>'); inOl = true; }
        result.push('<li>' + line.replace(/^\d+\.\s+/, '') + '</li>');
        continue;
      }

      if (inList) { result.push('</ul>'); inList = false; }
      if (inOl) { result.push('</ol>'); inOl = false; }

      // Blockquote
      if (/^&gt;\s?/.test(line)) {
        result.push('<blockquote>' + line.replace(/^&gt;\s?/, '') + '</blockquote>');
        continue;
      }

      // Empty line → paragraph break
      if (line.trim() === '') {
        result.push('</p><p>');
        continue;
      }

      // Regular line
      result.push(line + '<br>');
    }
    if (inList) result.push('</ul>');
    if (inOl) result.push('</ol>');

    return '<p>' + result.join('\n') + '</p>';
  }

  // ===========================================================================
  // Auto-save drafts (new reviews only)
  // ===========================================================================
  function saveDraft() {
    if (isPut) return; // Don't auto-save for edits
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        grade: gradeInput.value,
        body: textarea.value,
        spoilers: spoilerCb.checked,
        didFinish: didFinishCb.checked,
        ts: Date.now(),
      }));
    } catch (e) { /* quota exceeded — ignore */ }
  }

  function restoreDraft() {
    if (isPut) return; // Don't restore for edits
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var draft = JSON.parse(raw);

      // Expire drafts older than 7 days
      if (Date.now() - draft.ts > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }

      // Restore grade
      if (draft.grade) {
        selectGrade(draft.grade);
      }

      // Restore body
      if (draft.body) {
        textarea.value = draft.body;
        updateCharCount();
      }

      // Restore spoiler checkbox
      if (draft.spoilers) {
        spoilerCb.checked = true;
      }

      // Restore did-finish checkbox
      if (draft.didFinish !== undefined) {
        didFinishCb.checked = draft.didFinish;
      }
    } catch (e) { /* corrupt data — ignore */ }
  }

  function clearDraft() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  // Save on checkbox change
  spoilerCb.addEventListener('change', saveDraft);
  didFinishCb.addEventListener('change', saveDraft);

  // ===========================================================================
  // Initialize
  // ===========================================================================
  var existingGrade = gradeInput.value;
  var hasInteracted = !!existingGrade;

  if (existingGrade) {
    // Edit mode — pre-select grade
    selectGrade(existingGrade);
    var sel = strip.querySelector('.grade-pill.is-selected');
    if (sel) setTimeout(function () { sel.scrollIntoView({ inline: 'center', block: 'nearest' }); }, 50);
  } else {
    // New review — try restoring a draft
    updateDisplay(null);
    restoreDraft();
  }

  // ===========================================================================
  // Form submission
  // ===========================================================================
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!hasInteracted || !gradeInput.value) {
      messageEl.hidden = false;
      messageEl.className = 'nom-message nom-message--error';
      messageEl.textContent = 'Please select a grade.';
      return;
    }

    // Exit preview mode before submitting
    if (isPreviewMode) togglePreview();

    var grade = gradeInput.value;
    var body = textarea.value.trim();
    var hasSpoilers = spoilerCb.checked;

    submitBtn.disabled = true;
    submitBtn.textContent = isPut ? 'Updating\u2026' : 'Submitting\u2026';

    try {
      var action = form.getAttribute('action');
      var res = await fetch(action, {
        method: isPut ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ grade: grade, body: body, has_spoilers: hasSpoilers, did_finish: didFinishCb.checked }),
      });

      var data = await res.json();

      if (res.ok && data.success) {
        clearDraft();
        var bookPath = form.dataset.bookPath;
        window.location.href = bookPath;
        return;
      }

      messageEl.hidden = false;
      messageEl.className = 'nom-message nom-message--error';
      messageEl.textContent = data.error || 'Something went wrong.';
    } catch (err) {
      messageEl.hidden = false;
      messageEl.className = 'nom-message nom-message--error';
      messageEl.textContent = 'Network error. Please try again.';
    }

    submitBtn.disabled = false;
    submitBtn.textContent = isPut ? 'Update Review' : 'Submit Review';
  });
})();
