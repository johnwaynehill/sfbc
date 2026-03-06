/* Share button — Web Share API + clipboard fallback */
(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.share-btn');
    if (!btn) return;
    e.preventDefault();

    var title = btn.dataset.title || document.title;
    var url   = btn.dataset.url   || window.location.href;

    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        showCopied(btn);
      }).catch(function () {
        fallbackPrompt(url);
      });
      return;
    }

    fallbackPrompt(url);
  });

  function showCopied(btn) {
    var label = btn.querySelector('.share-btn__label');
    if (!label) return;
    var orig = label.textContent;
    label.textContent = 'Link copied!';
    setTimeout(function () { label.textContent = orig; }, 2000);
  }

  function fallbackPrompt(url) {
    window.prompt('Copy this link:', url);
  }
})();
