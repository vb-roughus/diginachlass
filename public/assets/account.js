/* Logik der Konto-Seite. */
(function () {
  const { api, $, showAlert, escapeHtml } = window.DNL;
  const alert = $('#alert');
  let account = null;

  function flash(type, msg) { showAlert(alert, type, msg); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  const CAT_LABELS = {
    kommunikation: 'Kommunikation', social_media: 'Social Media', finanzen: 'Finanzen',
    cloud: 'Cloud', krypto: 'Krypto', unterhaltung: 'Unterhaltung', sonstiges: 'Sonstiges',
  };
  const CAT_ORDER = ['kommunikation', 'social_media', 'finanzen', 'cloud', 'krypto', 'unterhaltung', 'sonstiges'];
  // Kategorie-Icons – dieselbe Bildsprache wie die Kategorien auf der Landingpage.
  const CAT_ICONS = {
    kommunikation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>',
    social_media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="7" r="2.3"/><circle cx="18" cy="7" r="2.3"/><circle cx="12" cy="17.5" r="2.3"/><path d="M8.1 8.2 10.4 15.4M15.9 8.2 13.6 15.4M8.2 7h7.6"/></svg>',
    finanzen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.7"/><path d="M6 9.4v5.2M18 9.4v5.2"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 18.5H7a4.2 4.2 0 0 1-.5-8.37A5.6 5.6 0 0 1 17.4 11.4a3.6 3.6 0 0 1 .1 7.1Z"/></svg>',
    krypto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.4 20.3 7v10L12 21.6 3.7 17V7z"/><path d="M10 9.4h3.1a1.8 1.8 0 0 1 0 3.6H10zm0 0v6.2m0-2.6h3.4a1.8 1.8 0 0 1 0 3.6H10"/></svg>',
    unterhaltung: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M10 8.4 16 12l-6 3.6z" fill="currentColor" stroke="none"/></svg>',
    sonstiges: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  };
  const CHEVRON = '<svg class="svc-cat-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

  let addedNames = new Set();

  // Durchsuchbare Auswahlliste — wird vom Server geladen und vom Administrator
  // unter "Dienst Erfassung" gepflegt. Nicht gelistete Dienste geben Nutzende
  // weiterhin einfach als eigenen Namen ein.
  let COMBO_ITEMS = [];

  async function loadServiceCatalog() {
    try {
      const { items } = await api('/services');
      COMBO_ITEMS = items.map((i) => ({
        name: i.name,
        category: i.category,
        label: CAT_LABELS[i.category] || i.category,
      }));
    } catch (err) {
      // Ohne Katalog bleibt die freie Eingabe funktionsfähig. Den Grund aber
      // sichtbar machen — eine leere Liste sieht sonst aus wie ein leerer Katalog.
      COMBO_ITEMS = [];
      // eslint-disable-next-line no-console
      console.warn('Dienst-Auswahl konnte nicht geladen werden:', err.message);
    }
  }

  // ---- Durchsuchbare Dienst-Auswahl (Combobox) -----------------------------
  function initCombo() {
    const input = $('#svc-name');
    const panel = $('#svc-combo-panel');
    const combo = $('#svc-combo');
    if (!input || !panel || !combo) return;

    let current = [];
    let activeIdx = -1;

    function open() { panel.hidden = false; input.setAttribute('aria-expanded', 'true'); }
    function close() { panel.hidden = true; input.setAttribute('aria-expanded', 'false'); activeIdx = -1; }

    function render() {
      const q = input.value.trim().toLowerCase();
      current = COMBO_ITEMS.filter((it) =>
        !q || it.name.toLowerCase().includes(q) || it.label.toLowerCase().includes(q));
      if (!current.length) {
        panel.innerHTML = '<div class="combo-empty">Kein Treffer – Ihre Eingabe wird als eigener Dienst übernommen.</div>';
        open();
        return;
      }
      panel.innerHTML = current.map((it, i) => {
        const added = addedNames.has(it.name.toLowerCase());
        return '<button type="button" class="combo-opt' + (i === activeIdx ? ' active' : '') + '" role="option" data-i="' + i + '">' +
          '<span class="combo-name">' + escapeHtml(it.name) + (added ? ' <span class="combo-added">✓ erfasst</span>' : '') + '</span>' +
          '<span class="combo-cat">' + escapeHtml(it.label) + '</span></button>';
      }).join('');
      panel.querySelectorAll('.combo-opt').forEach((btn) => {
        // mousedown statt click, damit der Input-Fokus nicht vorher verloren geht.
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); choose(current[Number(btn.dataset.i)]); });
      });
      open();
      if (activeIdx >= 0) {
        const act = panel.querySelector('.combo-opt.active');
        if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest' });
      }
    }

    function choose(it) {
      if (!it) return;
      input.value = it.name;
      $('#svc-cat').value = it.category;
      close();
      $('#svc-rel').focus();
    }

    input.addEventListener('focus', render);
    input.addEventListener('input', () => { activeIdx = -1; render(); });
    input.addEventListener('keydown', (e) => {
      if (panel.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, current.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (activeIdx >= 0) choose(current[activeIdx]); else close(); }
      else if (e.key === 'Escape') { close(); }
    });
    document.addEventListener('click', (e) => { if (!combo.contains(e.target)) close(); });
  }

  // ---- Init ----------------------------------------------------------------
  async function init() {
    account = await window.DNL.currentAccount();
    if (!account) { location.href = '/app/login.html?next=/app/account.html'; return; }

    const u = account.user;
    $('#hello').textContent = 'Willkommen' + (u.name ? ', ' + u.name : '');
    $('#pf-name').value = u.name || '';
    $('#pf-email').value = u.email;

    const badge = $('#plan-badge');
    if (account.entitlement.premium) { badge.className = 'badge premium'; badge.textContent = 'Premium'; }
    else { badge.className = 'badge free'; badge.textContent = 'Kostenlos'; }

    if (!u.emailVerified) {
      const n = $('#verify-note');
      n.style.display = 'block';
      n.innerHTML = '⚠ Bitte bestätigen Sie Ihre E-Mail-Adresse. Erst danach können Sie Dienste erfassen und Premium kaufen.';
    }

    renderBilling();
    render2fa();
    initCombo();
    setupAdmin();
    await Promise.all([loadServiceCatalog(), loadCompendium(), loadAccounts(), loadTrusted()]);
  }

  // ---- Compendium ----------------------------------------------------------
  async function loadCompendium() {
    const el = $('#compendium');
    try {
      const preview = await api('/compendium/preview');
      let html = '<p class="muted">' + preview.total + ' Dienst(e) erfasst · ' +
        preview.documented + ' dokumentiert · ' + preview.highRelevance + ' mit hoher Relevanz.</p>';
      if (account.entitlement.premium) {
        const full = await api('/compendium');
        html += '<p style="margin-top:10px"><b>Vollständigkeit: ' + full.completeness + '%</b> · ' +
          full.trustedPersons + ' Vertrauensperson(en)</p>';
        if (full.risks.length) {
          html += '<p style="margin-top:10px"><b>Risikoindikatoren:</b></p><ul class="risk-list">' +
            full.risks.map((r) => '<li>' + escapeHtml(r) + '</li>').join('') + '</ul>';
        } else {
          html += '<p class="muted" style="margin-top:10px">Keine offensichtlichen Risiken erkannt.</p>';
        }
        html += '<p style="margin-top:16px"><a class="btn btn-clay btn-sm" href="/api/compendium/whitepaper.pdf">White Paper (PDF) beziehen</a></p>' +
          '<p class="muted" style="margin-top:4px">Enthält Ihre Risikoübersicht sowie offizielle Anlaufstellen zur Nachlasshandhabung im Todesfall.</p>';
      } else {
        html += '<p class="muted" style="margin-top:10px">Risikoanalyse, Vollständigkeitsprüfung und Export sind Teil von Premium. ' +
          '<a href="/app/upgrade.html" style="color:var(--forest);font-weight:600">Premium freischalten →</a></p>';
      }
      el.innerHTML = html;
    } catch (err) {
      el.innerHTML = '<p class="muted">' + escapeHtml(err.message) + '</p>';
    }
  }

  // ---- Dienste -------------------------------------------------------------
  async function loadAccounts() {
    const el = $('#accounts-list');
    try {
      const { items } = await api('/accounts');
      addedNames = new Set(items.map((a) => (a.serviceName || '').trim().toLowerCase()));

      // Nach Kategorie gruppieren.
      const byCat = {};
      for (const a of items) (byCat[a.category] = byCat[a.category] || []).push(a);

      const itemRow = (a) =>
        '<div class="item"><div class="top"><span class="name">' + escapeHtml(a.serviceName) + '</span>' +
        '<button class="btn btn-ghost btn-sm" data-del="' + a.id + '">Löschen</button></div>' +
        '<div class="meta">Relevanz: ' + a.relevance + ' · Zugang: ' + a.accessDocumented + '</div>' +
        (a.notes ? '<div class="muted" style="margin-top:6px">' + escapeHtml(a.notes) + '</div>' : '') +
        '</div>';

      const cats = CAT_ORDER.map((cat) => {
        const list = byCat[cat] || [];
        const body = list.length
          ? list.map(itemRow).join('')
          : '<p class="svc-cat-empty">Noch keine Dienste in dieser Kategorie.</p>';
        return '<details class="svc-cat"' + (list.length ? ' open' : '') + '>' +
          '<summary class="svc-cat-head"><span class="cat-ico">' + (CAT_ICONS[cat] || '') + '</span>' +
          '<span class="svc-cat-title">' + escapeHtml(CAT_LABELS[cat] || cat) + '</span>' +
          '<span class="svc-cat-count">' + list.length + '</span>' + CHEVRON + '</summary>' +
          '<div class="svc-cat-body">' + body + '</div></details>';
      }).join('');

      el.innerHTML = '<div class="svc-cats">' + cats + '</div>' +
        (items.length ? '' : '<p class="muted" style="margin-top:12px">Noch keine Dienste erfasst – fügen Sie unten Ihren ersten Dienst hinzu.</p>');

      el.querySelectorAll('[data-del]').forEach((b) =>
        b.addEventListener('click', () => delAccount(b.dataset.del)));
    } catch (err) {
      el.innerHTML = '<p class="muted">' + escapeHtml(err.message) + '</p>';
    }
  }

  async function delAccount(id) {
    if (!confirm('Diesen Dienst löschen?')) return;
    try { await api('/accounts/' + id, { method: 'DELETE' }); await loadAccounts(); await loadCompendium(); }
    catch (err) { flash('error', err.message); }
  }

  $('#account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      serviceName: $('#svc-name').value.trim(),
      category: $('#svc-cat').value,
      relevance: $('#svc-rel').value,
      accessDocumented: $('#svc-doc').value,
    };
    const notes = $('#svc-notes').value.trim();
    if (notes) body.notes = notes;
    try {
      await api('/accounts', { method: 'POST', body });
      e.target.reset();
      await loadAccounts(); await loadCompendium();
      flash('ok', 'Dienst hinzugefügt.');
    } catch (err) { flash('error', window.DNL.fieldErrors(err)); }
  });

  // ---- Vertrauenspersonen (Premium) ---------------------------------------
  async function loadTrusted() {
    const el = $('#trusted-section');
    try {
      const { items } = await api('/trusted-persons');
      let html = items.length
        ? items.map((t) => '<div class="item"><div class="top"><span class="name">' + escapeHtml(t.name) +
            '</span><button class="btn btn-ghost btn-sm" data-tdel="' + t.id + '">Löschen</button></div>' +
            '<div class="meta">' + escapeHtml(t.relationship) + (t.email ? ' · ' + escapeHtml(t.email) : '') + '</div></div>').join('')
        : '<p class="muted">Noch keine Vertrauensperson hinterlegt.</p>';
      html += '<div class="sep"></div><form id="trusted-form"><div class="row">' +
        '<div class="field"><label>Name</label><input type="text" id="tp-name" required></div>' +
        '<div class="field"><label>Beziehung</label><input type="text" id="tp-rel" placeholder="z. B. Tochter" required></div>' +
        '<div class="field"><label>E-Mail (optional)</label><input type="email" id="tp-email"></div></div>' +
        '<button class="btn btn-primary btn-sm" type="submit">Hinzufügen</button></form>';
      el.innerHTML = html;
      el.querySelectorAll('[data-tdel]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (!confirm('Vertrauensperson löschen?')) return;
          try { await api('/trusted-persons/' + b.dataset.tdel, { method: 'DELETE' }); await loadTrusted(); }
          catch (err) { flash('error', err.message); }
        }));
      $('#trusted-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = { name: $('#tp-name').value.trim(), relationship: $('#tp-rel').value.trim() };
        const email = $('#tp-email').value.trim(); if (email) body.email = email;
        try { await api('/trusted-persons', { method: 'POST', body }); await loadTrusted(); flash('ok', 'Vertrauensperson hinzugefügt.'); }
        catch (err) { flash('error', window.DNL.fieldErrors(err)); }
      });
    } catch (err) {
      if (err.status === 402) {
        el.innerHTML = '<p class="muted">Die Verwaltung der Vertrauenspersonen ist Teil von Premium. ' +
          '<a href="/app/upgrade.html" style="color:var(--forest);font-weight:600">Premium freischalten →</a></p>';
      } else {
        el.innerHTML = '<p class="muted">' + escapeHtml(err.message) + '</p>';
      }
    }
  }

  // ---- Abrechnung ----------------------------------------------------------
  function renderBilling() {
    const ent = account.entitlement;
    const text = $('#billing-text');
    const upgrade = $('#upgrade-link'), portal = $('#portal-btn'), cancel = $('#cancel-btn');
    upgrade.style.display = portal.style.display = cancel.style.display = 'none';

    if (ent.premium && ent.type === 'lifetime') {
      text.textContent = 'Premium aktiv – lebenslang (Einmalzahlung). Vielen Dank!';
    } else if (ent.premium && ent.type === 'subscription') {
      const until = ent.validUntil ? new Date(ent.validUntil).toLocaleDateString('de-CH') : '';
      text.textContent = ent.cancelAtPeriodEnd
        ? 'Premium-Abo aktiv, gekündigt zum ' + until + '.'
        : 'Premium-Abo aktiv' + (until ? ', nächste Verlängerung am ' + until + '.' : '.');
      portal.style.display = 'inline-flex';
      if (!ent.cancelAtPeriodEnd) cancel.style.display = 'inline-flex';
    } else {
      text.textContent = 'Aktueller Plan: Kostenlos. Schalten Sie Premium für das vollständige Compendium frei.';
      upgrade.style.display = 'inline-flex';
    }
  }

  $('#portal-btn').addEventListener('click', async () => {
    try { const res = await api('/billing/portal', { method: 'POST' }); location.href = res.url; }
    catch (err) { flash('error', err.message); }
  });
  $('#cancel-btn').addEventListener('click', async () => {
    if (!confirm('Abo zum Ende der Laufzeit kündigen?')) return;
    try { const res = await api('/billing/cancel', { method: 'POST' }); flash('ok', res.message); account = await window.DNL.currentAccount(); renderBilling(); }
    catch (err) { flash('error', err.message); }
  });

  // ---- Profil --------------------------------------------------------------
  $('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {};
    const name = $('#pf-name').value.trim();
    const email = $('#pf-email').value.trim();
    const newpw = $('#pf-newpw').value;
    const curpw = $('#pf-curpw').value;
    body.name = name || null;
    if (email && email !== account.user.email) body.email = email;
    if (newpw) body.newPassword = newpw;
    if (curpw) body.currentPassword = curpw;
    try {
      const res = await api('/account', { method: 'PATCH', body });
      flash('ok', res.message);
      $('#pf-newpw').value = ''; $('#pf-curpw').value = '';
      account = await window.DNL.currentAccount();
    } catch (err) { flash('error', window.DNL.fieldErrors(err)); }
  });

  // ---- 2FA -----------------------------------------------------------------
  function render2fa() {
    const el = $('#twofa-section');
    if (account.user.twoFactorEnabled) {
      el.innerHTML = '<p class="muted">2FA ist <b>aktiv</b>.</p>' +
        '<form id="twofa-disable" style="margin-top:10px"><div class="field" style="max-width:280px">' +
        '<label>Passwort zum Deaktivieren</label><input type="password" id="tf-pw"></div>' +
        '<button class="btn btn-ghost btn-sm" type="submit">2FA deaktivieren</button></form>';
      $('#twofa-disable').addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await api('/auth/2fa/disable', { method: 'POST', body: { password: $('#tf-pw').value } });
          flash('ok', '2FA wurde deaktiviert.'); account = await window.DNL.currentAccount(); render2fa(); }
        catch (err) { flash('error', err.message); }
      });
    } else {
      el.innerHTML = '<p class="muted">Empfohlen für dieses sensible Produkt.</p>' +
        '<button class="btn btn-ghost btn-sm" id="twofa-start" style="margin-top:8px">2FA einrichten</button><div id="twofa-setup"></div>';
      $('#twofa-start').addEventListener('click', startTwofa);
    }
  }

  async function startTwofa() {
    const box = $('#twofa-setup');
    try {
      const res = await api('/auth/2fa/setup', { method: 'POST' });
      box.innerHTML = '<div style="margin-top:14px"><p class="muted">Scannen Sie den QR-Code mit Ihrer Authenticator-App:</p>' +
        '<img src="' + res.qrDataUrl + '" alt="2FA QR-Code" style="margin:10px 0;border:1px solid var(--line);border-radius:10px">' +
        '<p class="muted">Oder manuell: <span class="mono">' + escapeHtml(res.secret) + '</span></p>' +
        '<form id="twofa-confirm" style="margin-top:10px"><div class="field" style="max-width:220px">' +
        '<label>Bestätigungscode</label><input type="text" id="tf-code" inputmode="numeric" class="mono"></div>' +
        '<button class="btn btn-primary btn-sm" type="submit">2FA aktivieren</button></form></div>';
      $('#twofa-confirm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await api('/auth/2fa/verify', { method: 'POST', body: { token: $('#tf-code').value.trim() } });
          flash('ok', '2FA wurde aktiviert.'); account = await window.DNL.currentAccount(); render2fa(); }
        catch (err) { flash('error', err.message); }
      });
    } catch (err) { flash('error', err.message); }
  }

  // ---- Konto löschen -------------------------------------------------------
  $('#delete-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!confirm('Konto und alle Daten wirklich endgültig löschen?')) return;
    try {
      await api('/account', { method: 'DELETE', body: { password: $('#del-pw').value, confirm: $('#del-confirm').value } });
      location.href = '/?deleted=1';
    } catch (err) { flash('error', window.DNL.fieldErrors(err)); }
  });

  // ---- Admin-Zone: Dienst-Katalog -------------------------------------------
  function setupAdmin() {
    if (!account || !account.user || account.user.role !== 'admin') return;
    const box = $('#side-admin');
    if (box) box.hidden = false;
    const form = $('#cat-form');
    if (form) form.addEventListener('submit', createCatalogService);
    loadCatalogAdmin();
  }

  async function loadCatalogAdmin() {
    const el = $('#cat-list');
    if (!el) return;
    try {
      const { items } = await api('/admin/services');
      if (!items.length) {
        el.innerHTML = '<p class="muted">Noch keine Dienste im Katalog. Legen Sie unten den ersten an.</p>';
        return;
      }
      const byCat = {};
      for (const i of items) (byCat[i.category] = byCat[i.category] || []).push(i);

      el.innerHTML = CAT_ORDER.filter((c) => byCat[c]).map((c) =>
        '<div style="margin-bottom:16px"><div class="admin-cat-label">' +
          escapeHtml(CAT_LABELS[c] || c) + ' · ' + byCat[c].length + '</div>' +
        byCat[c].map((i) =>
          '<div class="item"><div class="top">' +
            '<span class="name">' + escapeHtml(i.name) +
              (i.active ? '' : ' <span class="badge free" style="margin-left:8px">inaktiv</span>') +
            '</span>' +
            '<span style="display:flex;gap:8px;flex:0 0 auto">' +
              '<button class="btn btn-ghost btn-sm" data-toggle="' + i.id + '" data-active="' + (i.active ? '1' : '0') + '">' +
                (i.active ? 'Deaktivieren' : 'Aktivieren') + '</button>' +
              '<button class="btn btn-ghost btn-sm" data-delcat="' + i.id + '">Löschen</button>' +
            '</span>' +
          '</div></div>'
        ).join('') + '</div>'
      ).join('');

      el.querySelectorAll('[data-delcat]').forEach((b) =>
        b.addEventListener('click', () => deleteCatalogService(b.dataset.delcat)));
      el.querySelectorAll('[data-toggle]').forEach((b) =>
        b.addEventListener('click', () => toggleCatalogService(b.dataset.toggle, b.dataset.active !== '1')));
    } catch (err) {
      el.innerHTML = '<p class="muted">' + escapeHtml(err.message) + '</p>';
    }
  }

  async function createCatalogService(e) {
    e.preventDefault();
    const body = {
      name: $('#cat-name').value.trim(),
      category: $('#cat-cat').value,
      sortOrder: Number($('#cat-sort').value || 0),
    };
    try {
      await api('/admin/services', { method: 'POST', body });
      $('#cat-form').reset();
      $('#cat-sort').value = '0';
      flash('ok', 'Dienst wurde zum Katalog hinzugefügt.');
      await Promise.all([loadCatalogAdmin(), loadServiceCatalog()]);
    } catch (err) { flash('error', window.DNL.fieldErrors(err)); }
  }

  async function toggleCatalogService(id, active) {
    try {
      await api('/admin/services/' + id, { method: 'PATCH', body: { active } });
      await Promise.all([loadCatalogAdmin(), loadServiceCatalog()]);
    } catch (err) { flash('error', err.message); }
  }

  async function deleteCatalogService(id) {
    if (!confirm('Diesen Dienst aus dem Katalog entfernen? Bereits erfasste Nutzer-Dienste bleiben erhalten.')) return;
    try {
      await api('/admin/services/' + id, { method: 'DELETE' });
      flash('ok', 'Dienst aus dem Katalog entfernt.');
      await Promise.all([loadCatalogAdmin(), loadServiceCatalog()]);
    } catch (err) { flash('error', err.message); }
  }

  // ---- Logout --------------------------------------------------------------
  $('#logout').addEventListener('click', async (e) => {
    e.preventDefault();
    try { await api('/auth/logout', { method: 'POST' }); } catch (_) {}
    location.href = '/';
  });

  init();
})();
