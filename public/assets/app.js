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

  function showAlert(el, type, msg) {
    if (!el) return;
    el.className = 'alert show alert-' + type;
    el.textContent = msg;
  }
  function hideAlert(el) {
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
})();
