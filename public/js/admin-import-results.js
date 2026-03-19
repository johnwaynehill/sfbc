/**
 * admin-import-results.js — Bulk import historical voting results.
 *
 * Workflow: file upload -> preview (dry-run) -> confirm -> commit
 */
(function () {
  'use strict';

  var fileInput = document.getElementById('import-file-input');
  var fileMsg = document.getElementById('import-file-message');
  var previewSection = document.getElementById('preview-section');
  var previewSummary = document.getElementById('preview-summary');
  var previewTbody = document.getElementById('preview-tbody');
  var commitBtn = document.getElementById('commit-btn');
  var resetBtn = document.getElementById('reset-btn');
  var commitMsg = document.getElementById('commit-message');

  var uploadedData = null;

  // -- Helpers --

  function showMsg(el, msg, isError) {
    if (!el) return;
    el.hidden = false;
    el.className = 'nom-message nom-message--' + (isError ? 'error' : 'success');
    el.textContent = msg;
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function statusPill(status) {
    var map = {
      'import': { cls: 'voting', label: 'New Import' },
      'overwrite': { cls: 'nominations', label: 'Overwrite' },
      'error': { cls: 'scheduled', label: 'Error' },
    };
    var s = map[status] || { cls: 'results', label: status };
    return '<span class="status-pill status-pill--' + s.cls + '">' + esc(s.label) + '</span>';
  }

  // -- Step 2: File Upload --

  if (fileInput) {
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;

      // Reset previous state
      previewSection.hidden = true;
      commitMsg.hidden = true;
      commitBtn.disabled = true;
      commitBtn.textContent = 'Import Results';

      if (!file.name.endsWith('.json')) {
        showMsg(fileMsg, 'Please select a .json file.', true);
        return;
      }

      var reader = new FileReader();
      reader.onload = async function (e) {
        var data;
        try {
          data = JSON.parse(e.target.result);
        } catch (err) {
          showMsg(fileMsg, 'Invalid JSON file: ' + err.message, true);
          return;
        }

        if (!Array.isArray(data)) {
          showMsg(fileMsg, 'JSON must be an array of entries.', true);
          return;
        }

        // Count entries that have pollResults
        var withData = data.filter(function (e) {
          return e.pollResults && Array.isArray(e.pollResults) && e.pollResults.length > 0;
        });
        if (withData.length === 0) {
          showMsg(fileMsg, 'No entries with pollResults found. Nothing to import.', true);
          return;
        }

        showMsg(fileMsg, 'Parsed ' + data.length + ' entries (' + withData.length + ' with results). Validating\u2026', false);
        uploadedData = data;

        // Send to preview endpoint
        try {
          var res = await fetch('/api/admin/import-results/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(data),
          });

          var result = await res.json();

          if (!res.ok || !result.success) {
            showMsg(fileMsg, result.error || 'Preview failed.', true);
            return;
          }

          renderPreview(result);
          showMsg(fileMsg, 'File validated. Review the preview below.', false);
        } catch (err) {
          showMsg(fileMsg, 'Network error during preview.', true);
        }
      };

      reader.onerror = function () {
        showMsg(fileMsg, 'Failed to read file.', true);
      };

      reader.readAsText(file);
    });
  }

  // -- Step 3: Render Preview --

  function renderPreview(result) {
    var s = result.summary;
    previewSummary.innerHTML =
      '<p class="t-body">' +
      '<strong>' + s.toImport + '</strong> new import' + (s.toImport !== 1 ? 's' : '') + ', ' +
      '<strong>' + s.toOverwrite + '</strong> overwrite' + (s.toOverwrite !== 1 ? 's' : '') + ', ' +
      '<strong>' + s.errors + '</strong> error' + (s.errors !== 1 ? 's' : '') +
      '</p>';

    var html = '';
    for (var i = 0; i < result.preview.length; i++) {
      var p = result.preview[i];
      html += '<tr>';
      html += '<td class="t-body">' + esc(p.monthYear) + '</td>';
      html += '<td class="t-body text-secondary">' + esc(p.title || '') + '</td>';
      html += '<td class="t-body" style="text-align: right;">' + (p.rankingsCount || '&mdash;') + '</td>';
      html += '<td class="t-body" style="text-align: right;">' + (p.totalVotes || '&mdash;') + '</td>';
      html += '<td>' + statusPill(p.status);
      if (p.reason) {
        html += ' <span class="t-caption text-secondary">' + esc(p.reason) + '</span>';
      }
      html += '</td>';
      html += '</tr>';
    }

    previewTbody.innerHTML = html;
    previewSection.hidden = false;

    // Enable commit only if there's something to import
    commitBtn.disabled = (s.toImport + s.toOverwrite) === 0;
  }

  // -- Step 4: Commit --

  if (commitBtn) {
    commitBtn.addEventListener('click', async function () {
      if (!uploadedData) return;

      if (!await showConfirm('Import results for all listed months? This will write to the database.')) {
        return;
      }

      commitBtn.disabled = true;
      commitBtn.textContent = 'Importing\u2026';
      commitMsg.hidden = true;

      try {
        var res = await fetch('/api/admin/import-results/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(uploadedData),
        });

        var data = await res.json();

        if (res.ok && data.success) {
          showMsg(commitMsg,
            'Done! Imported: ' + data.imported +
            ', Overwritten: ' + data.overwritten +
            ', Skipped: ' + data.skipped +
            ', Errors: ' + data.errors +
            '. Reloading\u2026',
            false
          );
          setTimeout(function () { window.location.reload(); }, 2000);
          return;
        }

        showMsg(commitMsg, data.error || 'Import failed.', true);
      } catch (err) {
        showMsg(commitMsg, 'Network error during import.', true);
      }

      commitBtn.disabled = false;
      commitBtn.textContent = 'Import Results';
    });
  }

  // -- Reset --

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      uploadedData = null;
      previewSection.hidden = true;
      previewTbody.innerHTML = '';
      previewSummary.innerHTML = '';
      fileInput.value = '';
      fileMsg.hidden = true;
      commitMsg.hidden = true;
      commitBtn.disabled = true;
      commitBtn.textContent = 'Import Results';
    });
  }
})();
