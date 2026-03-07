/**
 * nominate-form.js — Progressive enhancement for the nomination form.
 *
 * 1. Live cover preview (debounced Google Books search)
 * 2. Tap preview card to fill in form with canonical details
 * 3. Character counter for the "Why this book?" textarea
 * 4. Fetch-based form submission with cover URL + metadata
 */
(function () {
  'use strict';

  var form = document.getElementById('nom-form');
  if (!form) return; // already-nominated state, no form on page

  var titleInput   = document.getElementById('nom-title');
  var authorInput  = document.getElementById('nom-author');
  var reasonInput  = document.getElementById('nom-reason');
  var counter      = document.getElementById('reason-counter');
  var submitBtn    = document.getElementById('nom-submit');
  var messageEl    = document.getElementById('nom-message');

  // Cover preview elements
  var previewWrap  = document.getElementById('cover-preview');
  var previewImg   = document.getElementById('preview-img');
  var previewTitle = document.getElementById('preview-title');
  var previewAuthor = document.getElementById('preview-author');
  var previewYear  = document.getElementById('preview-year');

  var meetingId = form.dataset.meetingId;
  var meetingSlug = form.dataset.meetingSlug;

  // Stores the last Google Books result so we can send metadata on submit
  var lastPreviewData = null;

  // -----------------------------------------------------------------------
  // Search-first nomination flow
  // -----------------------------------------------------------------------
  var searchInput = document.getElementById('nom-search-input');
  var searchResults = document.getElementById('nom-search-results');
  var searchTimer = null;

  if (searchInput && searchResults) {
    searchInput.addEventListener('input', function () {
      var q = searchInput.value.trim();
      clearTimeout(searchTimer);

      if (q.length < 3) {
        searchResults.hidden = true;
        return;
      }

      searchTimer = setTimeout(function () {
        fetch('/api/books/search-multi?q=' + encodeURIComponent(q) + '&maxResults=5')
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (!data.results || data.results.length === 0) {
              searchResults.innerHTML = '<div class="nom-search__empty">No books found. Try entering manually below.</div>';
              searchResults.hidden = false;
              return;
            }

            var html = '';
            for (var i = 0; i < data.results.length; i++) {
              var r = data.results[i];
              html += '<div class="nom-search__item" data-idx="' + i + '"'
                + ' data-title="' + escapeAttr(r.title) + '"'
                + ' data-author="' + escapeAttr(r.author) + '"'
                + ' data-cover="' + escapeAttr(r.coverUrl || '') + '"'
                + ' data-year="' + (r.year || '') + '"'
                + ' data-gbid="' + escapeAttr(r.googleBooksId || '') + '"'
                + ' data-isbn="' + escapeAttr(r.isbn || '') + '"'
                + ' data-pages="' + (r.pageCount || '') + '">'
                + (r.coverUrl ? '<img src="' + escapeAttr(r.coverUrl) + '" alt="">' : '')
                + '<div class="nom-search__item-info">'
                + '<span class="nom-search__item-title">' + escapeHtml(r.title) + '</span>'
                + '<span class="nom-search__item-author">' + escapeHtml(r.author) + (r.year ? ' (' + r.year + ')' : '') + '</span>'
                + '</div></div>';
            }

            searchResults.innerHTML = html;
            searchResults.hidden = false;
          })
          .catch(function () {
            searchResults.hidden = true;
          });
      }, 350);
    });

    // Click a search result to fill the form
    searchResults.addEventListener('click', function (e) {
      var item = e.target.closest('.nom-search__item');
      if (!item) return;

      var title = item.dataset.title;
      var author = item.dataset.author;

      titleInput.value = title;
      authorInput.value = author;

      // Store preview data for metadata on submit
      lastPreviewData = {
        title: title,
        author: author,
        coverUrl: item.dataset.cover || null,
        year: item.dataset.year ? parseInt(item.dataset.year, 10) : null,
        googleBooksId: item.dataset.gbid || null,
      };

      // Show the existing preview card
      if (item.dataset.cover) {
        previewImg.src = item.dataset.cover;
        previewImg.alt = title + ' cover';
        previewTitle.textContent = title;
        previewAuthor.textContent = author;
        previewYear.textContent = item.dataset.year ? '(' + item.dataset.year + ')' : '';
        previewWrap.hidden = false;
      }

      // Hide search results, clear search input
      searchResults.hidden = true;
      searchInput.value = '';

      // Scroll form into view and focus reason
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (reasonInput) setTimeout(function () { reasonInput.focus(); }, 300);
    });

    // Close search results when clicking outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nom-search')) {
        searchResults.hidden = true;
      }
    });
  }

  function escapeAttr(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // -----------------------------------------------------------------------
  // Character counter
  // -----------------------------------------------------------------------
  if (reasonInput && counter) {
    var MAX = 280;

    function updateCounter() {
      var len = reasonInput.value.length;
      counter.textContent = len + ' / ' + MAX;
      counter.classList.toggle('char-counter--warn', len >= MAX - 20);
    }

    reasonInput.addEventListener('input', updateCounter);
    updateCounter();
  }

  // -----------------------------------------------------------------------
  // Live cover preview (debounced)
  // -----------------------------------------------------------------------
  var debounceTimer = null;
  var lastQuery = '';

  function triggerPreview() {
    var title  = (titleInput.value || '').trim();
    var author = (authorInput.value || '').trim();
    var query  = title + '||' + author;

    // Don't re-fetch for same query
    if (query === lastQuery) return;
    lastQuery = query;

    // Need at least 2 chars in each field
    if (title.length < 2 || author.length < 2) {
      previewWrap.hidden = true;
      lastPreviewData = null;
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      fetch('/api/books/search?title=' +
        encodeURIComponent(title) + '&author=' + encodeURIComponent(author))
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.found) {
            previewImg.src = data.coverUrl;
            previewImg.alt = data.title + ' cover';
            previewTitle.textContent = data.title;
            previewAuthor.textContent = data.author;
            previewYear.textContent = data.year ? '(' + data.year + ')' : '';
            previewWrap.hidden = false;

            // Store for later use (including API metadata for submission)
            lastPreviewData = {
              title: data.title,
              author: data.author,
              coverUrl: data.coverUrl,
              year: data.year || null,
              googleBooksId: data.googleBooksId || null,
            };
          } else {
            previewWrap.hidden = true;
            lastPreviewData = null;
          }
        })
        .catch(function () {
          previewWrap.hidden = true;
          lastPreviewData = null;
        });
    }, 400);
  }

  titleInput.addEventListener('input', triggerPreview);
  authorInput.addEventListener('input', triggerPreview);

  // -----------------------------------------------------------------------
  // Tap preview to fill in form with canonical Google Books details
  // -----------------------------------------------------------------------
  previewWrap.addEventListener('click', function () {
    if (!lastPreviewData) return;

    titleInput.value = lastPreviewData.title;
    authorInput.value = lastPreviewData.author;

    // Brief visual confirmation
    previewWrap.style.borderColor = 'var(--accent)';
    previewWrap.style.background = 'rgba(180, 83, 9, 0.06)';
    setTimeout(function () {
      previewWrap.style.borderColor = '';
      previewWrap.style.background = '';
    }, 600);
  });

  // -----------------------------------------------------------------------
  // Fetch-based form submission (includes cover URL + metadata)
  // -----------------------------------------------------------------------
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var title  = (titleInput.value || '').trim();
    var author = (authorInput.value || '').trim();
    var reason = (reasonInput ? reasonInput.value : '').trim();

    if (!title || !author) return;

    // Disable button to prevent double-submit
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting\u2026';

    // Build metadata from preview data if available
    var metadata = {};
    if (lastPreviewData) {
      if (lastPreviewData.coverUrl) metadata.coverUrl = lastPreviewData.coverUrl;
      if (lastPreviewData.year) metadata.publicationYear = lastPreviewData.year;
      if (lastPreviewData.googleBooksId) metadata.googleBooksId = lastPreviewData.googleBooksId;
    }

    fetch('/api/meetings/' + meetingId + '/nominations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        title: title,
        author: author,
        reason: reason,
        _metadata: metadata,
      }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data.success) {
          // Show confirmation card and hide the form + search
          form.hidden = true;
          var searchSection = document.getElementById('nom-search');
          var dividerEl = document.getElementById('nom-divider');
          if (searchSection) searchSection.hidden = true;
          if (dividerEl) dividerEl.hidden = true;
          messageEl.hidden = false;
          messageEl.className = '';

          var slug = result.data.meetingSlug || meetingSlug;
          var book = result.data.book;
          var coverHtml = book.coverUrl
            ? '<div class="book-cover book-cover--sm"><img src="' + escapeHtml(book.coverUrl) + '" alt="Cover of ' + escapeHtml(book.title) + '"></div>'
            : '';
          var reasonHtml = reason
            ? '<p class="nom-confirmed__reason">&ldquo;' + escapeHtml(reason) + '&rdquo;</p>'
            : '';

          messageEl.innerHTML =
            '<div class="nom-confirmed">' +
              '<p class="nom-confirmed__badge">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                  '<polyline points="20 6 9 17 4 12"></polyline>' +
                '</svg>' +
                'Nomination Submitted' +
              '</p>' +
              '<div class="nom-confirmed__card">' +
                coverHtml +
                '<div class="nom-confirmed__details">' +
                  '<span class="nom-confirmed__title">' + escapeHtml(book.title) + '</span>' +
                  '<span class="nom-confirmed__author">by ' + escapeHtml(book.author) + '</span>' +
                  reasonHtml +
                '</div>' +
              '</div>' +
              '<div class="nom-confirmed__actions">' +
                '<a href="/" class="btn btn--primary">Back to Home</a>' +
                '<a href="/nominate/' + slug + '?edit=1" class="btn btn--secondary">Edit Nomination</a>' +
              '</div>' +
            '</div>';
        } else {
          showError(result.data.error || 'Something went wrong.');
        }
      })
      .catch(function () {
        showError('Network error. Please try again.');
      });
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
