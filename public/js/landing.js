/* Landing page: scroll reveals, counter animation, header scroll state */
(function () {
  'use strict';

  /* --- Scroll reveal via IntersectionObserver --- */
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(function (el) {
    observer.observe(el);
  });

  /* --- Animated counters --- */
  var counters = document.querySelectorAll('[data-count]');
  var counterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  counters.forEach(function (el) { counterObserver.observe(el); });

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    var duration = 1400;
    var start = null;

    function tick(now) {
      if (!start) start = now;
      var progress = Math.min((now - start) / duration, 1);
      // ease-out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }

    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = target;
    } else {
      requestAnimationFrame(tick);
    }
  }

  /* --- Header scroll state --- */
  var header = document.querySelector('.lp-header');
  if (header) {
    var hero = document.querySelector('.lp-hero');
    var heroHeight = hero ? hero.offsetHeight * 0.4 : 200;

    function onScroll() {
      if (window.scrollY > heroHeight) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- Waitlist form submission --- */
  var form = document.getElementById('waitlistForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var errorEl = document.getElementById('waitlistError');
      var successEl = document.getElementById('waitlistSuccess');
      var btn = form.querySelector('.lp-form__submit');
      var origText = btn.textContent;

      errorEl.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Joining…';

      var payload = {
        name: form.elements['name'].value,
        email: form.elements['email'].value,
        clubName: form.elements['clubName'].value,
        cityState: form.elements['cityState'].value,
        website: form.elements['website'].value
      };

      fetch('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      }).then(function (res) {
        if (res.ok && res.data && res.data.success) {
          form.hidden = true;
          successEl.hidden = false;
          successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          errorEl.textContent = (res.data && res.data.error) || 'Something went wrong. Please try again.';
          errorEl.hidden = false;
          btn.disabled = false;
          btn.textContent = origText;
        }
      }).catch(function () {
        errorEl.textContent = 'Network error. Please check your connection and try again.';
        errorEl.hidden = false;
        btn.disabled = false;
        btn.textContent = origText;
      });
    });
  }
})();
