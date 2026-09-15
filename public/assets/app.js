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

  window.DNL = { api, fetchCsrf, $, showAlert, hideAlert, fieldErrors, escapeHtml, currentAccount };

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
