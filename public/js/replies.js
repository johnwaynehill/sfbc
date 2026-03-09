/**
 * replies.js — Inline reply system for review cards.
 *
 * Handles: show/hide reply form, submit, edit, delete, char count.
 * Renders new replies client-side using the same avatar + markdown
 * patterns as the server-rendered ones.
 */
(function () {
  'use strict';

  var MAX_CHARS = 2000;

  // ---- Lightweight client-side markdown (mirrors review-form.js) ----
  function renderMarkdownSimple(text) {
    if (!text) return '';
    var html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Spoiler: ||text||
    html = html.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>');
    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic: *text*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  function formatDate(isoString) {
    var d = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ===========================================================================
  // Compact markdown toolbar for reply forms
  // ===========================================================================
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.md-toolbar--compact [data-action]');
    if (!btn) return;

    var formWrap = btn.closest('.reply-form-wrap');
    if (!formWrap) return;

    var ta = formWrap.querySelector('.reply-form__textarea');
    if (!ta) return;

    var action = btn.dataset.action;
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var text = ta.value;
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
      case 'spoiler':
        replacement = '||' + (selected || 'spoiler text') + '||';
        cursorOffset = selected ? replacement.length : 2;
        break;
      case 'link':
        if (selected) {
          replacement = '[' + selected + '](url)';
          cursorOffset = replacement.length - 1;
        } else {
          replacement = '[link text](url)';
          cursorOffset = 1;
        }
        break;
      default:
        return;
    }

    ta.value = before + replacement + after;
    var newPos = start + cursorOffset;
    ta.setSelectionRange(newPos, newPos);
    ta.focus();
    updateCharCount(formWrap);
  });

  // ===========================================================================
  // Reply trigger — toggle form visibility
  // ===========================================================================
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.reply-trigger');
    if (!trigger) return;

    var reviewId = trigger.dataset.reviewId;
    var formWrap = trigger.closest('.reply-section').querySelector('.reply-form-wrap');
    if (!formWrap) return;

    var isHidden = formWrap.hidden;
    formWrap.hidden = !isHidden;

    if (isHidden) {
      var ta = formWrap.querySelector('.reply-form__textarea');
      if (ta) ta.focus();
    }
  });

  // ===========================================================================
  // Cancel button — hide form and clear textarea
  // ===========================================================================
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.reply-form__cancel')) return;

    var formWrap = e.target.closest('.reply-form-wrap');
    if (!formWrap) return;

    var ta = formWrap.querySelector('.reply-form__textarea');
    if (ta) ta.value = '';
    updateCharCount(formWrap);

    // If editing, exit edit mode
    var editId = formWrap.dataset.editingReplyId;
    if (editId) {
      delete formWrap.dataset.editingReplyId;
      var submitBtn = formWrap.querySelector('.reply-form__submit');
      if (submitBtn) submitBtn.textContent = 'Reply';
    }

    formWrap.hidden = true;
  });

  // ===========================================================================
  // Character count
  // ===========================================================================
  document.addEventListener('input', function (e) {
    if (!e.target.classList.contains('reply-form__textarea')) return;
    var formWrap = e.target.closest('.reply-form-wrap');
    if (formWrap) updateCharCount(formWrap);
  });

  function updateCharCount(formWrap) {
    var ta = formWrap.querySelector('.reply-form__textarea');
    var counter = formWrap.querySelector('.reply-form__char-count');
    if (!ta || !counter) return;

    var len = ta.value.length;
    counter.textContent = len.toLocaleString() + ' / ' + MAX_CHARS.toLocaleString();
    counter.classList.toggle('reply-form__char-count--warn', len > MAX_CHARS * 0.9);
    counter.classList.toggle('reply-form__char-count--over', len > MAX_CHARS);
  }

  // ===========================================================================
  // Submit reply (POST) or update (PUT)
  // ===========================================================================
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.reply-form__submit')) return;

    var formWrap = e.target.closest('.reply-form-wrap');
    if (!formWrap) return;

    var ta = formWrap.querySelector('.reply-form__textarea');
    var body = ta ? ta.value.trim() : '';
    if (!body) return;

    var submitBtn = formWrap.querySelector('.reply-form__submit');
    var editId = formWrap.dataset.editingReplyId;

    submitBtn.disabled = true;
    submitBtn.textContent = editId ? 'Updating…' : 'Sending…';

    if (editId) {
      // PUT — update existing reply
      fetch('/api/replies/' + editId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ body: body }),
      })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (result) {
          if (result.ok && result.data.success) {
            // Update the reply body in the DOM
            var replyEl = document.querySelector('.reply[data-reply-id="' + editId + '"]');
            if (replyEl) {
              var bodyEl = replyEl.querySelector('.reply__body');
              if (bodyEl) bodyEl.innerHTML = renderMarkdownSimple(body);
              // Add (edited) indicator if not already present
              var dateEl = replyEl.querySelector('.reply__date');
              if (dateEl && !dateEl.querySelector('.reply__edited')) {
                var editedSpan = document.createElement('span');
                editedSpan.className = 'reply__edited';
                editedSpan.textContent = ' (edited)';
                dateEl.appendChild(editedSpan);
              }
            }
            // Reset form
            ta.value = '';
            updateCharCount(formWrap);
            delete formWrap.dataset.editingReplyId;
            formWrap.hidden = true;
          } else {
            showAlert(result.data.error || 'Could not update reply.');
          }
        })
        .catch(function () { showAlert('Network error. Please try again.'); })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reply';
        });
    } else {
      // POST — new reply
      var reviewId = formWrap.dataset.reviewId;

      fetch('/api/reviews/' + reviewId + '/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ body: body }),
      })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (result) {
          if (result.ok && result.data.success) {
            var reply = result.data.reply;
            appendReply(formWrap.closest('.reply-section'), reply);
            ta.value = '';
            updateCharCount(formWrap);
            formWrap.hidden = true;
            // Update reply count on trigger button
            updateTriggerCount(formWrap.closest('.reply-section'));
          } else {
            showAlert(result.data.error || 'Could not post reply.');
          }
        })
        .catch(function () { showAlert('Network error. Please try again.'); })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reply';
        });
    }
  });

  // ===========================================================================
  // Append a newly created reply to the DOM
  // ===========================================================================
  function appendReply(section, reply) {
    var list = section.querySelector('.reply-list');
    if (!list) {
      list = document.createElement('div');
      list.className = 'reply-list';
      section.insertBefore(list, section.firstChild);
    }

    var el = document.createElement('div');
    el.className = 'reply reply--new';
    el.dataset.replyId = reply.id;
    el.dataset.userId = reply.user_id;

    // Build avatar
    var dn = reply.display_name || reply.email || '?';
    var words = dn.trim().split(/\s+/);
    var initials = words.length >= 2
      ? words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase()
      : words[0].charAt(0).toUpperCase();

    var avatarHtml;
    if (reply.avatar_style && reply.avatar_style !== 'initials') {
      avatarHtml = '<img class="avatar avatar--sm" src="https://api.dicebear.com/9.x/' +
        encodeURIComponent(reply.avatar_style) + '/svg?seed=' + encodeURIComponent(dn) +
        '" alt="' + dn + '" loading="lazy">';
    } else {
      avatarHtml = '<span class="avatar avatar--sm">' + initials + '</span>';
    }

    var authorLink = reply.user_slug
      ? '<a href="/members/' + reply.user_slug + '" class="reply__author-link">' + avatarHtml + '<span class="reply__author">' + escapeHtml(reply.display_name) + '</span></a>'
      : '<span class="reply__author-link">' + avatarHtml + '<span class="reply__author">' + escapeHtml(reply.display_name || 'Anonymous') + '</span></span>';

    el.innerHTML =
      '<div class="reply__meta">' +
        authorLink +
        '<span class="reply__date">' + formatDate(reply.created_at) + '</span>' +
      '</div>' +
      '<div class="reply__body">' + renderMarkdownSimple(reply.body_markdown) + '</div>' +
      '<div class="reply__actions">' +
        '<button type="button" class="reply__edit-btn" data-reply-id="' + reply.id + '">Edit</button>' +
        '<button type="button" class="reply__delete-btn" data-reply-id="' + reply.id + '">Delete</button>' +
      '</div>';

    list.appendChild(el);

    // Trigger entrance animation
    requestAnimationFrame(function () {
      el.classList.remove('reply--new');
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===========================================================================
  // Edit reply — populate form with existing body
  // ===========================================================================
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.reply__edit-btn');
    if (!btn) return;

    var replyId = btn.dataset.replyId;
    var replyEl = btn.closest('.reply');
    var section = replyEl.closest('.reply-section');
    var formWrap = section.querySelector('.reply-form-wrap');
    if (!formWrap) return;

    // Get current body text (from the rendered HTML, fallback to textContent)
    var bodyEl = replyEl.querySelector('.reply__body');
    // We need the markdown source — fetch it or use textContent as approximation
    // For simplicity, we'll use textContent since we don't store raw markdown client-side
    var ta = formWrap.querySelector('.reply-form__textarea');
    ta.value = bodyEl ? bodyEl.textContent.trim() : '';
    updateCharCount(formWrap);

    // Mark as editing
    formWrap.dataset.editingReplyId = replyId;

    var submitBtn = formWrap.querySelector('.reply-form__submit');
    if (submitBtn) submitBtn.textContent = 'Update';

    formWrap.hidden = false;
    ta.focus();
  });

  // ===========================================================================
  // Delete reply
  // ===========================================================================
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('.reply__delete-btn');
    if (!btn) return;

    if (!await showConfirm('Delete this reply?', { danger: true })) return;

    var replyId = btn.dataset.replyId;
    var replyEl = btn.closest('.reply');
    var section = replyEl.closest('.reply-section');

    btn.disabled = true;

    try {
      var res = await fetch('/api/replies/' + replyId, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
      });
      var data = await res.json();
      if (data.success) {
        replyEl.style.opacity = '0';
        replyEl.style.transform = 'translateY(-8px)';
        replyEl.style.transition = 'opacity 0.25s, transform 0.25s';
        setTimeout(function () {
          replyEl.remove();
          // Remove empty reply-list container
          var list = section.querySelector('.reply-list');
          if (list && list.children.length === 0) list.remove();
          updateTriggerCount(section);
        }, 260);
      } else {
        showAlert(data.error || 'Could not delete reply.');
        btn.disabled = false;
      }
    } catch (_) {
      showAlert('Network error. Please try again.');
      btn.disabled = false;
    }
  });

  // ===========================================================================
  // Update the trigger button reply count
  // ===========================================================================
  function updateTriggerCount(section) {
    var trigger = section.querySelector('.reply-trigger');
    if (!trigger) return;

    var list = section.querySelector('.reply-list');
    var count = list ? list.children.length : 0;

    // Rebuild trigger text with SVG intact
    var svg = trigger.querySelector('svg');
    var svgHtml = svg ? svg.outerHTML : '';
    trigger.innerHTML = svgHtml + '\n                Reply' + (count > 0 ? ' (' + count + ')' : '');
  }
})();
