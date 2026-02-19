/**
 * nominate-form.js — Progressive enhancement for the nomination form.
 *
 * 1. Live cover preview (debounced Google Books search)
 * 2. Character counter for the "Why this book?" textarea
 * 3. Fetch-based form submission with inline feedback
 */
(function () {
  'use strict';

  const form = document.getElementById('nom-form');
  if (!form) return; // already-nominated state, no form on page

  const titleInput   = document.getElementById('nom-title');
  const authorInput  = document.getElementById('nom-author');
  const reasonInput  = document.getElementById('nom-reason');
  const counter      = document.getElementById('reason-counter');
  const submitBtn    = document.getElementById('nom-submit');
  const messageEl    = document.getElementById('nom-message');

  // Cover preview elements
  const previewWrap  = document.getElementById('cover-preview');
  const searchingEl  = document.getElementById('cover-searching');
  const previewImg   = document.getElementById('preview-img');
  const previewTitle = document.getElementById('preview-title');
  const previewAuthor = document.getElementById('preview-author');
  const previewYear  = document.getElementById('preview-year');

  const meetingId = form.dataset.meetingId;

  // -----------------------------------------------------------------------
  // Character counter
  // -----------------------------------------------------------------------
  if (reasonInput && counter) {
    const MAX = 280;

    function updateCounter() {
      const len = reasonInput.value.length;
      counter.textContent = len + ' / ' + MAX;
      counter.classList.toggle('char-counter--warn', len >= MAX - 20);
    }

    reasonInput.addEventListener('input', updateCounter);
    updateCounter();
  }

  // -----------------------------------------------------------------------
  // Live cover preview (debounced)
  // -----------------------------------------------------------------------
  let debounceTimer = null;
  let lastQuery = '';

  function triggerPreview() {
    const title  = (titleInput.value || '').trim();
    const author = (authorInput.value || '').trim();
    const query  = title + '||' + author;

    // Don't re-fetch for same query
    if (query === lastQuery) return;
    lastQuery = query;

    // Need at least 2 chars in each field
    if (title.length < 2 || author.length < 2) {
      previewWrap.hidden = true;
      searchingEl.hidden = true;
      return;
    }

    // Show searching indicator
    searchingEl.hidden = false;
    previewWrap.hidden = true;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async function () {
      try {
        const url = '/api/books/search?title=' +
          encodeURIComponent(title) + '&author=' + encodeURIComponent(author);
        const res = await fetch(url);
        const data = await res.json();

        searchingEl.hidden = true;

        if (data.found) {
          previewImg.src = data.coverUrl;
          previewImg.alt = data.title + ' cover';
          previewTitle.textContent = data.title;
          previewAuthor.textContent = data.author;
          previewYear.textContent = data.year ? '(' + data.year + ')' : '';
          previewWrap.hidden = false;
        } else {
          previewWrap.hidden = true;
        }
      } catch {
        searchingEl.hidden = true;
        previewWrap.hidden = true;
      }
    }, 400);
  }

  titleInput.addEventListener('input', triggerPreview);
  authorInput.addEventListener('input', triggerPreview);

  // -----------------------------------------------------------------------
  // Fetch-based form submission
  // -----------------------------------------------------------------------
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const title  = (titleInput.value || '').trim();
    const author = (authorInput.value || '').trim();
    const reason = (reasonInput ? reasonInput.value : '').trim();

    if (!title || !author) return;

    // Disable button to prevent double-submit
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting\u2026';

    try {
      const res = await fetch('/api/meetings/' + meetingId + '/nominations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ title: title, author: author, reason: reason }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Show success message and hide the form
        form.hidden = true;
        messageEl.hidden = false;
        messageEl.className = 'nom-message nom-message--success';
        messageEl.innerHTML =
          'Nomination submitted! You nominated <strong>' +
          escapeHtml(data.book.title) + '</strong> by ' +
          escapeHtml(data.book.author) + '.' +
          '<br><a href="/results/' + meetingId + '" class="btn btn--primary" style="margin-top: var(--s-3); display: inline-flex;">View Live Results &rarr;</a>';
      } else {
        showError(data.error || 'Something went wrong.');
      }
    } catch {
      showError('Network error. Please try again.');
    }
  });

  function showError(msg) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Nomination';
    messageEl.hidden = false;
    messageEl.className = 'nom-message nom-message--error';
    messageEl.textContent = msg;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();
