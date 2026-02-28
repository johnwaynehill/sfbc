/**
 * Winner Reveal Animation
 * Full-screen book cover takeover with CSS confetti, then shrinks to reveal the winner card.
 * Progressive enhancement: falls back gracefully without JS.
 * Respects prefers-reduced-motion.
 */
(function () {
  'use strict';

  // Only run once per session per meeting
  var winner = document.querySelector('.results-winner[data-winner-cover]');
  if (!winner) return;

  var coverUrl = winner.getAttribute('data-winner-cover');
  var title = winner.getAttribute('data-winner-title');
  if (!coverUrl) return; // No cover image, skip animation

  // Check reduced motion preference
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // Only show once per meeting (use sessionStorage key)
  var config = window.__RESULTS_CONFIG__ || {};
  var storageKey = 'winner-revealed-' + (config.meetingId || 'unknown');
  if (sessionStorage.getItem(storageKey)) return;
  sessionStorage.setItem(storageKey, '1');

  // ---- Build overlay ----
  var overlay = document.createElement('div');
  overlay.className = 'winner-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  // Close button
  var closeBtn = document.createElement('button');
  closeBtn.className = 'winner-overlay__close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  overlay.appendChild(closeBtn);

  // Book cover
  var coverWrap = document.createElement('div');
  coverWrap.className = 'winner-overlay__cover';
  var img = document.createElement('img');
  img.src = coverUrl;
  img.alt = title + ' cover';
  coverWrap.appendChild(img);
  overlay.appendChild(coverWrap);

  // Star burst (winner text)
  var label = document.createElement('div');
  label.className = 'winner-overlay__label';
  label.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Winner';
  overlay.appendChild(label);

  // CSS confetti particles
  var confettiColors = ['#FFD700', '#FF6B35', '#FFA500', '#FFE066', '#F59E0B', '#FBBF24', '#EF4444', '#EC4899', '#8B5CF6', '#10B981'];
  for (var i = 0; i < 40; i++) {
    var particle = document.createElement('span');
    particle.className = 'winner-confetti';
    particle.style.left = (Math.random() * 100) + '%';
    particle.style.animationDelay = (Math.random() * 1.5) + 's';
    particle.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    particle.style.background = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    particle.style.width = (4 + Math.random() * 8) + 'px';
    particle.style.height = (4 + Math.random() * 8) + 'px';
    particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    particle.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
    overlay.appendChild(particle);
  }

  // Hide the winner card initially
  winner.style.opacity = '0';
  winner.style.transform = 'scale(0.95)';
  winner.style.transition = 'opacity 600ms ease, transform 600ms ease';

  // Insert overlay
  document.body.appendChild(overlay);

  // Trigger entrance after paint
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      overlay.classList.add('is-entering');
    });
  });

  // Dismiss helper
  function dismiss() {
    if (overlay.classList.contains('is-dismissing')) return;
    overlay.classList.add('is-dismissing');
    winner.style.opacity = '1';
    winner.style.transform = 'scale(1)';
    setTimeout(function () {
      overlay.remove();
    }, 600);
  }

  // Close button click
  closeBtn.addEventListener('click', dismiss);

  // Also dismiss on Escape key
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      dismiss();
      document.removeEventListener('keydown', onKey);
    }
  });
})();
