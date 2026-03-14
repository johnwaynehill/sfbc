/**
 * profile.js — All profile page interactions
 *
 * Sections: Avatar picker, Display name, Social links, Password
 */
(function () {
  'use strict';

  // ---- Helpers ----
  function showMsg(el, type, text) {
    el.hidden = false;
    el.className = 'nom-message nom-message--' + type;
    el.textContent = text;
  }

  function clearMsg(el) {
    el.hidden = true;
    el.textContent = '';
  }

  async function apiPut(url, body) {
    var res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });
    var data = await res.json();
    return { ok: res.ok, data: data };
  }

  // ---- 0. Avatar Picker Tabs ----
  var pickerTabs = document.querySelector('.avatar-picker__tabs');
  if (pickerTabs) {
    pickerTabs.addEventListener('click', function (e) {
      var tab = e.target.closest('.avatar-picker__tab');
      if (!tab) return;
      var group = tab.dataset.group;

      // Toggle active tab
      pickerTabs.querySelectorAll('.avatar-picker__tab').forEach(function (t) {
        var active = t.dataset.group === group;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      // Toggle active panel
      document.querySelectorAll('.avatar-picker__panel').forEach(function (p) {
        p.classList.toggle('is-active', p.dataset.group === group);
      });
    });
  }

  // ---- 1. Avatar Picker ----
  var picker = document.getElementById('avatar-picker');
  var avatarMsg = document.getElementById('avatar-message');
  if (picker) {
    picker.addEventListener('click', async function (e) {
      var btn = e.target.closest('.avatar-picker__option');
      if (!btn) return;

      var style = btn.dataset.style;
      if (!style) return;

      // Optimistic UI — mark active immediately
      picker.querySelectorAll('.avatar-picker__option').forEach(function (b) {
        b.classList.remove('is-active');
      });
      btn.classList.add('is-active');

      try {
        var result = await apiPut('/api/auth/avatar-style', { avatar_style: style });
        if (result.ok && result.data.success) {
          showMsg(avatarMsg, 'success', 'Avatar updated!');
          // Reload to update all avatar instances (nav, preview, etc.)
          setTimeout(function () { location.reload(); }, 600);
        } else {
          showMsg(avatarMsg, 'error', result.data.error || 'Something went wrong.');
        }
      } catch (err) {
        showMsg(avatarMsg, 'error', 'Network error. Please try again.');
      }
    });
  }

  // ---- 2. Display Name ----
  var profileForm = document.getElementById('profile-form');
  var profileMsg = document.getElementById('profile-message');
  if (profileForm) {
    var profileBtn = document.getElementById('profile-submit');

    profileForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var name = profileForm.querySelector('[name="display_name"]').value.trim();
      if (!name) return;

      profileBtn.disabled = true;
      profileBtn.textContent = 'Saving\u2026';
      clearMsg(profileMsg);

      try {
        var result = await apiPut('/api/auth/display-name', { display_name: name });
        if (result.ok && result.data.success) {
          showMsg(profileMsg, 'success', 'Display name updated!');

          // Update nav avatar text (initials-based)
          var navAvatar = document.querySelector('.nav-avatar .avatar');
          if (navAvatar && navAvatar.tagName !== 'IMG') {
            var words = name.trim().split(/\s+/);
            var initials = words.length >= 2
              ? words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase()
              : words[0].charAt(0).toUpperCase();
            navAvatar.textContent = initials;
          }
        } else {
          showMsg(profileMsg, 'error', result.data.error || 'Something went wrong.');
        }
      } catch (err) {
        showMsg(profileMsg, 'error', 'Network error. Please try again.');
      }

      profileBtn.disabled = false;
      profileBtn.textContent = 'Save Changes';
    });
  }

  // ---- Slug Preview (with server-side collision check) ----
  var nameInput = document.querySelector('[name="display_name"]');
  var slugPreview = document.getElementById('slug-preview');
  var slugTimer = null;

  function localSlug(val) {
    return val.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }

  function updateSlugPreview() {
    if (!nameInput || !slugPreview) return;
    var val = nameInput.value.trim();
    if (!val) {
      slugPreview.innerHTML = 'Your profile URL will appear after you set a name.';
      slugPreview.className = 'slug-preview';
      return;
    }

    var slug = localSlug(val);

    // Instant local feedback
    slugPreview.innerHTML = 'Checking <code>/members/' + (slug || 'member') + '</code>\u2026';
    slugPreview.className = 'slug-preview';

    // Server-side availability check
    fetch('/api/auth/check-slug?name=' + encodeURIComponent(val))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        // Only update if input hasn't changed
        if (nameInput.value.trim() !== val) return;
        if (data.available) {
          slugPreview.innerHTML = '\u2713 Your profile: <code>/members/' + data.slug + '</code>';
          slugPreview.className = 'slug-preview slug-preview--available';
        } else {
          slugPreview.innerHTML = '\u26a0 That name is taken \u2014 you\u2019d get <code>/members/' + data.suggestion + '</code>';
          slugPreview.className = 'slug-preview slug-preview--taken';
        }
      })
      .catch(function () {
        // Graceful fallback — show local preview without status
        if (nameInput.value.trim() !== val) return;
        slugPreview.innerHTML = 'Your profile: <code>/members/' + (slug || 'member') + '</code>';
        slugPreview.className = 'slug-preview';
      });
  }

  if (nameInput && slugPreview) {
    nameInput.addEventListener('input', function () {
      clearTimeout(slugTimer);
      slugTimer = setTimeout(updateSlugPreview, 350);
    });
  }

  // ---- 3. Social Links ----
  var socialForm = document.getElementById('social-form');
  var socialMsg = document.getElementById('social-message');
  if (socialForm) {
    var socialBtn = document.getElementById('social-submit');

    socialForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      socialBtn.disabled = true;
      socialBtn.textContent = 'Saving\u2026';
      clearMsg(socialMsg);

      var body = {
        goodreads_url: socialForm.querySelector('[name="goodreads_url"]').value.trim(),
        storygraph_url: socialForm.querySelector('[name="storygraph_url"]').value.trim(),
        instagram_handle: socialForm.querySelector('[name="instagram_handle"]').value.trim(),
        threads_handle: socialForm.querySelector('[name="threads_handle"]').value.trim(),
      };

      try {
        var result = await apiPut('/api/auth/social-links', body);
        if (result.ok && result.data.success) {
          showMsg(socialMsg, 'success', 'Social links saved!');
        } else {
          showMsg(socialMsg, 'error', result.data.error || 'Something went wrong.');
        }
      } catch (err) {
        showMsg(socialMsg, 'error', 'Network error. Please try again.');
      }

      socialBtn.disabled = false;
      socialBtn.textContent = 'Save Links';
    });
  }

  // ---- 4. Password ----
  var pwForm = document.getElementById('password-form');
  var pwMsg = document.getElementById('password-message');
  if (pwForm) {
    var pwBtn = document.getElementById('password-submit');

    pwForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      pwBtn.disabled = true;
      pwBtn.textContent = 'Saving\u2026';
      clearMsg(pwMsg);

      var body = {
        current_password: (pwForm.querySelector('[name="current_password"]') || {}).value || '',
        new_password: pwForm.querySelector('[name="new_password"]').value,
        confirm_password: pwForm.querySelector('[name="confirm_password"]').value,
      };

      if (body.new_password !== body.confirm_password) {
        showMsg(pwMsg, 'error', 'Passwords do not match.');
        pwBtn.disabled = false;
        pwBtn.textContent = pwForm.querySelector('[name="current_password"]') ? 'Update Password' : 'Set Password';
        return;
      }

      try {
        var result = await apiPut('/api/auth/password', body);
        if (result.ok && result.data.success) {
          showMsg(pwMsg, 'success', 'Password saved!');
          pwForm.reset();
        } else {
          showMsg(pwMsg, 'error', result.data.error || 'Something went wrong.');
        }
      } catch (err) {
        showMsg(pwMsg, 'error', 'Network error. Please try again.');
      }

      pwBtn.disabled = false;
      pwBtn.textContent = pwForm.querySelector('[name="current_password"]') ? 'Update Password' : 'Set Password';
    });
  }
})();
