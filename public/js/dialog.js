'use strict';

/**
 * Shared dialog utility — replaces browser confirm() and alert() with
 * styled, accessible <dialog> modals.
 *
 * Usage:
 *   const ok = await showConfirm('Delete this review?', { danger: true });
 *   if (!ok) return;
 *
 *   await showAlert('Network error. Please try again.');
 */

/* global window, document */

(function () {
  // ── Singleton dialog element ────────────────────────────────────────────

  let _dialog = null;
  let _resolve = null;

  function getDialog() {
    if (_dialog) return _dialog;

    _dialog = document.createElement('dialog');
    _dialog.className = 'app-dialog';
    _dialog.setAttribute('aria-modal', 'true');
    _dialog.innerHTML = [
      '<div class="app-dialog__content">',
      '  <p class="app-dialog__title" id="dialog-title"></p>',
      '  <p class="app-dialog__message" id="dialog-message"></p>',
      '  <div class="app-dialog__actions">',
      '    <button type="button" class="app-dialog__btn app-dialog__btn--cancel">Cancel</button>',
      '    <button type="button" class="app-dialog__btn app-dialog__btn--confirm">OK</button>',
      '  </div>',
      '</div>',
    ].join('\n');

    _dialog.setAttribute('aria-labelledby', 'dialog-title');
    _dialog.setAttribute('aria-describedby', 'dialog-message');

    // Close on backdrop click
    _dialog.addEventListener('click', function (e) {
      if (e.target === _dialog) dismiss(false);
    });

    // Close on Escape (native <dialog> fires cancel event)
    _dialog.addEventListener('cancel', function (e) {
      e.preventDefault();
      dismiss(false);
    });

    // Button handlers (delegated)
    _dialog.addEventListener('click', function (e) {
      var btn = e.target.closest('.app-dialog__btn');
      if (!btn) return;
      if (btn.classList.contains('app-dialog__btn--confirm')) {
        dismiss(true);
      } else if (btn.classList.contains('app-dialog__btn--cancel')) {
        dismiss(false);
      }
    });

    document.body.appendChild(_dialog);
    return _dialog;
  }

  // ── Open / close helpers ────────────────────────────────────────────────

  function dismiss(value) {
    var dialog = getDialog();
    dialog.classList.add('is-closing');
    // Wait for exit animation before actually closing
    setTimeout(function () {
      dialog.classList.remove('is-closing');
      dialog.close();
      if (_resolve) {
        _resolve(value);
        _resolve = null;
      }
    }, 150);
  }

  function openDialog(opts) {
    var dialog = getDialog();
    var titleEl = dialog.querySelector('.app-dialog__title');
    var messageEl = dialog.querySelector('.app-dialog__message');
    var cancelBtn = dialog.querySelector('.app-dialog__btn--cancel');
    var confirmBtn = dialog.querySelector('.app-dialog__btn--confirm');

    // Title
    if (opts.title) {
      titleEl.textContent = opts.title;
      titleEl.hidden = false;
    } else {
      titleEl.hidden = true;
    }

    // Message
    messageEl.textContent = opts.message || '';

    // Danger variant
    dialog.classList.toggle('app-dialog--danger', !!opts.danger);

    // Mode: confirm vs alert
    if (opts.mode === 'alert') {
      cancelBtn.hidden = true;
      confirmBtn.textContent = opts.dismissText || 'OK';
      confirmBtn.className = 'app-dialog__btn app-dialog__btn--confirm';
    } else {
      cancelBtn.hidden = false;
      cancelBtn.textContent = opts.cancelText || 'Cancel';
      confirmBtn.textContent = opts.confirmText || (opts.danger ? 'Delete' : 'Confirm');
      confirmBtn.className = 'app-dialog__btn app-dialog__btn--confirm'
        + (opts.danger ? ' app-dialog__btn--danger' : '');
    }

    dialog.showModal();

    // Focus the confirm/OK button (or cancel for destructive actions)
    if (opts.danger && cancelBtn && !cancelBtn.hidden) {
      cancelBtn.focus();
    } else {
      confirmBtn.focus();
    }

    return new Promise(function (resolve) {
      _resolve = resolve;
    });
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Styled replacement for window.confirm().
   * @param {string} message — The question to ask
   * @param {Object} [options]
   * @param {string} [options.title] — Bold heading above the message
   * @param {string} [options.confirmText] — Confirm button label (default: "Confirm" or "Delete" if danger)
   * @param {string} [options.cancelText] — Cancel button label (default: "Cancel")
   * @param {boolean} [options.danger] — Red styling for destructive actions
   * @returns {Promise<boolean>} — true if confirmed, false if cancelled
   */
  window.showConfirm = function showConfirm(message, options) {
    var opts = options || {};
    opts.message = message;
    opts.mode = 'confirm';
    return openDialog(opts);
  };

  /**
   * Styled replacement for window.alert().
   * @param {string} message — The message to display
   * @param {Object} [options]
   * @param {string} [options.title] — Bold heading above the message
   * @param {string} [options.dismissText] — Button label (default: "OK")
   * @returns {Promise<void>}
   */
  window.showAlert = function showAlert(message, options) {
    var opts = options || {};
    opts.message = message;
    opts.mode = 'alert';
    return openDialog(opts);
  };
})();
