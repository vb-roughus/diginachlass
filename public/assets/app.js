/* Gemeinsamer Client-Helper für die App-Seiten.
   Keine Geheimnisse im Frontend. CSRF-Token wird automatisch mitgeführt. */
(function () {
  let csrfToken = null;

  async function fetchCsrf() {
    const r = await fetch('/api/csrf', { credentials: 'same-origin' });
    const data = await r.json();
    csrfToken = data.csrfToken;
    return csrfToken;
  }

  async function api(path, opts = {}) {
    const method = (opts.method || 'GET').toUpperCase();
    const headers = { ...(opts.headers || {}) };
    let body;

    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    if (method !== 'GET' && method !== 'HEAD') {
      if (!csrfToken) await fetchCsrf();
      headers['x-csrf-token'] = csrfToken;
    }

    const res = await fetch('/api' + path, {
      method,
      headers,
      body,
      credentials: 'same-origin',
    });

    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await res.json().catch(() => null);
    }

    if (!res.ok) {
      const err = new Error((data && data.error) || 'Es ist ein Fehler aufgetreten.');
      err.status = res.status;
      err.fields = (data && data.fields) || null;
      err.code = (data && data.code) || null;
      err.details = (data && data.details) || null;
      throw err;
    }
    return data;
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  let alertTimer = null;

  /**
   * Zeigt eine Meldung an. Erfolgsmeldungen blenden sich nach 5 Sekunden selbst
   * aus; Fehler bleiben stehen, damit sie nicht übersehen werden. Mit
   * autoHideMs lässt sich die Dauer überschreiben (0 = stehen lassen).
   */
  function showAlert(el, type, msg, autoHideMs) {
    if (!el) return;
    el.className = 'alert show alert-' + type;
    el.textContent = msg;
    if (alertTimer) { clearTimeout(alertTimer); alertTimer = null; }
    const ms = autoHideMs === undefined ? (type === 'ok' ? 5000 : 0) : autoHideMs;
    if (ms > 0) alertTimer = setTimeout(() => { hideAlert(el); alertTimer = null; }, ms);
  }
  function hideAlert(el) {
    if (alertTimer) { clearTimeout(alertTimer); alertTimer = null; }
    if (el) el.className = 'alert';
  }

  /**
   * Bestätigungsdialog innerhalb der Seite — ersetzt das Browser-confirm().
   * Liefert ein Promise mit true (bestätigt) oder false (abgebrochen).
   */
  function confirmDialog(opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      const previous = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      const lines = String(o.message || '')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => '<p class="modal-text">' + escapeHtml(l) + '</p>')
        .join('');

      overlay.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dnl-modal-title">' +
          '<h3 class="modal-title" id="dnl-modal-title">' + escapeHtml(o.title || 'Bitte bestätigen') + '</h3>' +
          lines +
          '<div class="modal-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-act="cancel">' +
              escapeHtml(o.cancelLabel || 'Abbrechen') + '</button>' +
            '<button type="button" class="btn ' + (o.danger ? 'btn-clay' : 'btn-primary') + ' btn-sm" data-act="ok">' +
              escapeHtml(o.confirmLabel || 'Bestätigen') + '</button>' +
          '</div>' +
        '</div>';

      const cancelBtn = overlay.querySelector('[data-act=cancel]');
      const okBtn = overlay.querySelector('[data-act=ok]');

      function close(result) {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        if (previous && previous.focus) previous.focus();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(false); }
        else if (e.key === 'Tab') {
          // Fokus im Dialog halten.
          e.preventDefault();
          (document.activeElement === okBtn ? cancelBtn : okBtn).focus();
        }
      }

      cancelBtn.addEventListener('click', () => close(false));
      okBtn.addEventListener('click', () => close(true));
      // Nur ein Klick auf die Fläche daneben schliesst, nicht einer im Dialog.
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(false); });
      document.addEventListener('keydown', onKey, true);

      document.body.appendChild(overlay);
      // Bei heiklen Aktionen bewusst "Abbrechen" vorbelegen.
      (o.danger ? cancelBtn : okBtn).focus();
    });
  }

  function fieldErrors(err) {
    if (!err.fields) return err.message;
    return err.fields.map((f) => f.message).join(' ');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function currentAccount() {
    try {
      return await api('/account');
    } catch (e) {
      return null;
    }
  }

  window.DNL = { api, fetchCsrf, $, showAlert, hideAlert, fieldErrors, escapeHtml, currentAccount, confirmDialog };

  // --- Konto-Dashboard: Panel-Navigation (nur bei vorhandener .app-shell) ---
  function initShell() {
    const shell = document.querySelector('.app-shell');
    if (!shell) return;
    const navLinks = Array.prototype.slice.call(shell.querySelectorAll('.side-link[data-panel]'));
    const panels = Array.prototype.slice.call(shell.querySelectorAll('.panel[data-panel]'));
    if (!navLinks.length || !panels.length) return;

    const titleEl = document.getElementById('panel-title');
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebar-scrim');

    function closeSidebar() {
      if (sidebar) sidebar.classList.remove('open');
      if (scrim) scrim.hidden = true;
    }
    function openSidebar() {
      if (sidebar) sidebar.classList.add('open');
      if (scrim) scrim.hidden = false;
    }

    function activate(name) {
      const link = navLinks.find((l) => l.dataset.panel === name) || navLinks[0];
      const target = link.dataset.panel;
      navLinks.forEach((l) => l.classList.toggle('active', l === link));
      panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === target));
      if (titleEl) titleEl.textContent = link.dataset.title || link.textContent.trim();
      try { history.replaceState(null, '', '#' + target); } catch (_) { location.hash = target; }
      closeSidebar();
    }

    navLinks.forEach((l) =>
      l.addEventListener('click', (e) => { e.preventDefault(); activate(l.dataset.panel); }));

    const toggle = document.getElementById('menu-toggle');
    if (toggle) {
      toggle.addEventListener('click', () =>
        sidebar && sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
    }
    if (scrim) scrim.addEventListener('click', closeSidebar);

    const initial = (location.hash || '').replace('#', '');
    activate(navLinks.some((l) => l.dataset.panel === initial) ? initial : navLinks[0].dataset.panel);
  }
  initShell();
})();
