/* Logik der Konto-Seite. */
(function () {
  const { api, $, showAlert, escapeHtml, confirmDialog } = window.DNL;
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

  // ---- Dienst erfassen: Overlay ---------------------------------------------
  let closeServiceModal = function () {};

  function setupServiceModal() {
    const overlay = $('#svc-modal');
    const openBtn = $('#svc-add-toggle');
    const cancelBtn = $('#svc-cancel');
    const form = $('#account-form');
    if (!overlay || !openBtn || !form) return;
    let previous = null;

    function open() {
      previous = document.activeElement;
      overlay.hidden = false;
      openBtn.setAttribute('aria-expanded', 'true');
      $('#svc-name').focus();
    }
    function close() {
      overlay.hidden = true;
      openBtn.setAttribute('aria-expanded', 'false');
      form.reset();
      const panel = $('#svc-combo-panel');
      if (panel) panel.hidden = true;
      if (previous && previous.focus) previous.focus();
    }
    closeServiceModal = close;

    openBtn.addEventListener('click', open);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

    // Capture-Phase: hier ist noch sichtbar, ob die Auswahlliste offen war.
    // Escape schliesst dann zuerst nur diese und erst danach das Overlay.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || overlay.hidden) return;
      const panel = $('#svc-combo-panel');
      if (panel && !panel.hidden) return;
      close();
    }, true);
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
    setupServiceModal();
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
    const ok = await confirmDialog({
      title: 'Dienst löschen?',
      message: 'Der Eintrag wird aus Ihrem Compendium entfernt.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
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
      closeServiceModal();
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
          const ok = await confirmDialog({
            title: 'Vertrauensperson löschen?',
            message: 'Die Person wird aus Ihrer Liste entfernt.',
            confirmLabel: 'Löschen',
            danger: true,
          });
          if (!ok) return;
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
    const ok = await confirmDialog({
      title: 'Abo kündigen?',
      message: 'Das Abonnement wird zum Ende der laufenden Periode gekündigt. Bis dahin bleibt Premium aktiv.',
      confirmLabel: 'Kündigen',
      danger: true,
    });
    if (!ok) return;
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
    const ok = await confirmDialog({
      title: 'Konto endgültig löschen?',
      message: 'Ihr Konto und sämtliche erfassten Daten werden unwiderruflich gelöscht.\nDieser Schritt lässt sich nicht rückgängig machen.',
      confirmLabel: 'Endgültig löschen',
      danger: true,
    });
    if (!ok) return;
    try {
      await api('/account', { method: 'DELETE', body: { password: $('#del-pw').value, confirm: $('#del-confirm').value } });
      location.href = '/?deleted=1';
    } catch (err) { flash('error', window.DNL.fieldErrors(err)); }
  });

  // ---- Admin-Zone: Dienst-Katalog -------------------------------------------
  let catalogItems = [];
  // Welche Kategorien offen sind, überdauert das Neuzeichnen der Liste.
  const catalogOpen = new Set();

  function setupAdmin() {
    if (!account || !account.user || account.user.role !== 'admin') return;
    const box = $('#side-admin');
    if (box) box.hidden = false;

    const form = $('#cat-form');
    if (form) form.addEventListener('submit', createCatalogService);

    // "+" oben rechts blendet das Formular ein und setzt den Fokus.
    const toggle = $('#cat-add-toggle');
    if (toggle && form) {
      toggle.addEventListener('click', () => {
        const show = form.hidden;
        form.hidden = !show;
        toggle.setAttribute('aria-expanded', show ? 'true' : 'false');
        toggle.title = show ? 'Formular schliessen' : 'Dienst hinzufügen';
        if (show) $('#cat-name').focus();
      });
    }
    const cancel = $('#cat-cancel');
    if (cancel) cancel.addEventListener('click', closeCatalogForm);

    const search = $('#cat-search');
    if (search) search.addEventListener('input', renderCatalogList);

    setupCompendium();
    setupAdminUsers();
    loadCatalogAdmin();
    loadAdminUsers();
  }

  function closeCatalogForm() {
    const form = $('#cat-form');
    const toggle = $('#cat-add-toggle');
    if (form) form.hidden = true;
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.title = 'Dienst hinzufügen';
    }
  }

  async function loadCatalogAdmin() {
    const el = $('#cat-list');
    if (!el) return;
    try {
      const { items } = await api('/admin/services');
      catalogItems = items;
      renderCatalogList();
      renderCompendiumList();
    } catch (err) {
      el.innerHTML = '<p class="muted">' + escapeHtml(err.message) + '</p>';
    }
  }

  function catalogRow(i) {
    return '<div class="item"><div class="top">' +
      '<span class="name">' + escapeHtml(i.name) +
        (i.active ? '' : ' <span class="badge free" style="margin-left:8px">inaktiv</span>') +
      '</span>' +
      '<span style="display:flex;gap:8px;flex:0 0 auto">' +
        '<button class="btn btn-ghost btn-sm" data-toggle="' + i.id + '" data-active="' + (i.active ? '1' : '0') + '">' +
          (i.active ? 'Deaktivieren' : 'Aktivieren') + '</button>' +
        '<button class="btn btn-ghost btn-sm" data-delcat="' + i.id + '">Löschen</button>' +
      '</span>' +
    '</div></div>';
  }

  function renderCatalogList() {
    const el = $('#cat-list');
    if (!el) return;

    if (!catalogItems.length) {
      el.innerHTML = '<p class="muted">Noch keine Dienste im Katalog. Legen Sie über „+" den ersten an.</p>';
      return;
    }

    const searchEl = $('#cat-search');
    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
    const matches = q
      ? catalogItems.filter((i) =>
          i.name.toLowerCase().includes(q) || (CAT_LABELS[i.category] || '').toLowerCase().includes(q))
      : catalogItems;

    if (!matches.length) {
      el.innerHTML = '<p class="muted">Kein Treffer für „' + escapeHtml(q) + '".</p>';
      return;
    }

    const byCat = {};
    for (const i of matches) (byCat[i.category] = byCat[i.category] || []).push(i);

    el.innerHTML = '<div class="svc-cats">' + CAT_ORDER.filter((c) => byCat[c]).map((c) => {
      // Standard: zugeklappt. Bei aktiver Suche aufklappen, sonst wären die
      // Treffer hinter zugeklappten Kategorien unsichtbar.
      const open = q ? true : catalogOpen.has(c);
      return '<details class="svc-cat" data-cat="' + c + '"' + (open ? ' open' : '') + '>' +
        '<summary class="svc-cat-head"><span class="cat-ico">' + (CAT_ICONS[c] || '') + '</span>' +
        '<span class="svc-cat-title">' + escapeHtml(CAT_LABELS[c] || c) + '</span>' +
        '<span class="svc-cat-count">' + byCat[c].length + '</span>' + CHEVRON + '</summary>' +
        '<div class="svc-cat-body">' + byCat[c].map(catalogRow).join('') + '</div></details>';
    }).join('') + '</div>';

    el.querySelectorAll('details.svc-cat').forEach((d) =>
      d.addEventListener('toggle', () => {
        // Bei aktiver Suche wird "offen" erzwungen — das ist keine Nutzer-
        // entscheidung und darf den gemerkten Zustand nicht überschreiben.
        const active = $('#cat-search') && $('#cat-search').value.trim();
        if (active) return;
        if (d.open) catalogOpen.add(d.dataset.cat);
        else catalogOpen.delete(d.dataset.cat);
      }));
    el.querySelectorAll('[data-delcat]').forEach((b) =>
      b.addEventListener('click', () => deleteCatalogService(b.dataset.delcat)));
    el.querySelectorAll('[data-toggle]').forEach((b) =>
      b.addEventListener('click', () => toggleCatalogService(b.dataset.toggle, b.dataset.active !== '1')));
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
      closeCatalogForm();
      // Die Kategorie des neuen Dienstes aufklappen, damit er sichtbar ist.
      catalogOpen.add(body.category);
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
    const ok = await confirmDialog({
      title: 'Dienst aus dem Katalog entfernen?',
      message: 'Der Dienst steht Nutzenden nicht mehr zur Auswahl.\nBereits erfasste Nutzer-Dienste bleiben erhalten.',
      confirmLabel: 'Entfernen',
      danger: true,
    });
    if (!ok) return;
    try {
      await api('/admin/services/' + id, { method: 'DELETE' });
      flash('ok', 'Dienst aus dem Katalog entfernt.');
      await Promise.all([loadCatalogAdmin(), loadServiceCatalog()]);
    } catch (err) { flash('error', err.message); }
  }

  // ---- Admin-Zone: Kompendium ------------------------------------------------
  const kompOpen = new Set();
  let kompEditing = null; // { id, name }

  function setupCompendium() {
    const form = $('#komp-form');
    if (form) form.addEventListener('submit', saveCompendiumEntry);
    const cancel = $('#komp-cancel');
    if (cancel) cancel.addEventListener('click', closeKompForm);
    const del = $('#komp-delete');
    if (del) del.addEventListener('click', deleteCompendiumEntry);
    const search = $('#komp-search');
    if (search) search.addEventListener('input', renderCompendiumList);
  }

  function closeKompForm() {
    kompEditing = null;
    const form = $('#komp-form');
    if (form) { form.reset(); form.hidden = true; }
    const del = $('#komp-delete');
    if (del) del.hidden = true;
  }

  function renderCompendiumList() {
    const el = $('#komp-list');
    if (!el) return;

    if (!catalogItems.length) {
      el.innerHTML = '<p class="muted">Noch keine Dienste im Katalog. Legen Sie zuerst unter „Dienst Erfassung" Dienste an.</p>';
      return;
    }

    const searchEl = $('#komp-search');
    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
    const matches = q
      ? catalogItems.filter((i) =>
          i.name.toLowerCase().includes(q) || (CAT_LABELS[i.category] || '').toLowerCase().includes(q))
      : catalogItems;

    if (!matches.length) {
      el.innerHTML = '<p class="muted">Kein Treffer für „' + escapeHtml(q) + '".</p>';
      return;
    }

    const byCat = {};
    for (const i of matches) (byCat[i.category] = byCat[i.category] || []).push(i);

    el.innerHTML = '<div class="svc-cats">' + CAT_ORDER.filter((c) => byCat[c]).map((c) => {
      const open = q ? true : kompOpen.has(c);
      const gepflegt = byCat[c].filter((i) => i.compendium).length;
      return '<details class="svc-cat" data-cat="' + c + '"' + (open ? ' open' : '') + '>' +
        '<summary class="svc-cat-head"><span class="cat-ico">' + (CAT_ICONS[c] || '') + '</span>' +
        '<span class="svc-cat-title">' + escapeHtml(CAT_LABELS[c] || c) + '</span>' +
        '<span class="svc-cat-count">' + gepflegt + '/' + byCat[c].length + '</span>' + CHEVRON + '</summary>' +
        '<div class="svc-cat-body">' + byCat[c].map((i) =>
          '<div class="item"><div class="top">' +
            '<span class="name">' + escapeHtml(i.name) +
              (i.compendium
                ? ' <span class="badge premium" style="margin-left:8px">gepflegt</span>'
                : ' <span class="badge free" style="margin-left:8px">offen</span>') +
            '</span>' +
            '<button class="btn btn-ghost btn-sm" data-komp="' + i.id + '" data-name="' + escapeHtml(i.name) + '">' +
              (i.compendium ? 'Bearbeiten' : 'Erfassen') + '</button>' +
          '</div></div>').join('') + '</div></details>';
    }).join('') + '</div>';

    el.querySelectorAll('details.svc-cat').forEach((d) =>
      d.addEventListener('toggle', () => {
        const active = $('#komp-search') && $('#komp-search').value.trim();
        if (active) return;
        if (d.open) kompOpen.add(d.dataset.cat); else kompOpen.delete(d.dataset.cat);
      }));
    el.querySelectorAll('[data-komp]').forEach((b) =>
      b.addEventListener('click', () => openCompendiumEntry(b.dataset.komp, b.dataset.name)));
  }

  async function openCompendiumEntry(serviceId, name) {
    kompEditing = { id: serviceId, name: name };
    $('#komp-form-service').textContent = 'Dienst: ' + name;

    let entry = null;
    try {
      const res = await api('/admin/compendium/' + serviceId);
      entry = res.item;
    } catch (err) {
      if (err.status !== 404) { flash('error', err.message); return; }
    }

    $('#komp-contact').value = entry ? entry.contactPoint : '';
    $('#komp-steps').value = entry && Array.isArray(entry.steps) ? entry.steps.join('\n') : '';
    $('#komp-links').value = entry && Array.isArray(entry.links)
      ? entry.links.map((l) => l.label + ' | ' + l.url).join('\n')
      : '';
    $('#komp-note').value = entry && entry.note ? entry.note : '';

    $('#komp-delete').hidden = !entry;
    $('#komp-form').hidden = false;
    $('#komp-contact').focus();
  }

  /** "Beschriftung | https://…" je Zeile -> [{ label, url }] */
  function parseLinks(text) {
    const out = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const at = line.indexOf('|');
      if (at === -1) throw new Error('Links bitte je Zeile als „Beschriftung | https://…" angeben.');
      const label = line.slice(0, at).trim();
      const url = line.slice(at + 1).trim();
      if (!label || !url) throw new Error('Links bitte je Zeile als „Beschriftung | https://…" angeben.');
      out.push({ label: label, url: url });
    }
    return out;
  }

  async function saveCompendiumEntry(e) {
    e.preventDefault();
    if (!kompEditing) return;
    let links;
    try { links = parseLinks($('#komp-links').value); }
    catch (err) { flash('error', err.message); return; }

    const note = $('#komp-note').value.trim();
    const body = {
      contactPoint: $('#komp-contact').value.trim(),
      steps: $('#komp-steps').value.split('\n').map((l) => l.trim()).filter(Boolean),
      links: links,
      note: note || null,
    };
    try {
      await api('/admin/compendium/' + kompEditing.id, { method: 'PUT', body });
      kompOpen.add((catalogItems.find((i) => i.id === kompEditing.id) || {}).category);
      flash('ok', 'Kompendium-Eintrag gespeichert.');
      closeKompForm();
      await loadCatalogAdmin();
    } catch (err) { flash('error', window.DNL.fieldErrors(err)); }
  }

  async function deleteCompendiumEntry() {
    if (!kompEditing) return;
    const ok = await confirmDialog({
      title: 'Kompendium-Eintrag löschen?',
      message: 'Die Informationen zu „' + kompEditing.name + '" werden entfernt.\nDer Dienst selbst bleibt erhalten.',
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    try {
      await api('/admin/compendium/' + kompEditing.id, { method: 'DELETE' });
      flash('ok', 'Kompendium-Eintrag gelöscht.');
      closeKompForm();
      await loadCatalogAdmin();
    } catch (err) { flash('error', err.message); }
  }

  // ---- Admin-Zone: Benutzer --------------------------------------------------
  let adminUsers = [];

  function setupAdminUsers() {
    const search = $('#usr-search');
    if (search) search.addEventListener('input', renderAdminUsers);
  }

  async function loadAdminUsers() {
    const el = $('#usr-list');
    if (!el) return;
    try {
      const { users } = await api('/admin/users');
      adminUsers = users;
      renderAdminUsers();
    } catch (err) {
      el.innerHTML = '<p class="muted">' + escapeHtml(err.message) + '</p>';
    }
  }

  function renderAdminUsers() {
    const el = $('#usr-list');
    if (!el) return;

    const searchEl = $('#usr-search');
    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
    const matches = q
      ? adminUsers.filter((u) =>
          (u.email || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q))
      : adminUsers;

    if (!matches.length) {
      el.innerHTML = '<p class="muted">' +
        (adminUsers.length ? 'Kein Treffer für „' + escapeHtml(q) + '".' : 'Keine Benutzer gefunden.') +
        '</p>';
      return;
    }

    el.innerHTML = matches.map((u) => {
      const ent = u.entitlement || {};
      const premium = ent.plan === 'premium';
      const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString('de-CH') : '—';
      const meta = [
        premium ? 'Premium' : 'Kostenlos',
        ent.type ? String(ent.type) : null,
        ent.status && ent.status !== 'none' ? 'Status: ' + ent.status : null,
        u.emailVerifiedAt ? 'verifiziert' : 'unbestätigt',
        'seit ' + created,
      ].filter(Boolean).join(' · ');

      return '<div class="item"><div class="top">' +
        '<span class="name">' + escapeHtml(u.email) +
          (u.role === 'admin' ? ' <span class="badge premium" style="margin-left:8px">Admin</span>' : '') +
          (premium ? ' <span class="badge premium" style="margin-left:8px">Premium</span>' : '') +
        '</span>' +
        (premium
          ? '<button class="btn btn-ghost btn-sm" data-reset="' + u.id + '" data-email="' + escapeHtml(u.email) + '">Auf Kostenlos zurücksetzen</button>'
          : '') +
      '</div><div class="meta">' + escapeHtml(meta) + '</div></div>';
    }).join('');

    el.querySelectorAll('[data-reset]').forEach((b) =>
      b.addEventListener('click', () => resetEntitlement(b.dataset.reset, b.dataset.email)));
  }

  async function resetEntitlement(userId, email) {
    const ok = await confirmDialog({
      title: 'Auf Kostenlos zurücksetzen?',
      message: 'Das Konto „' + email + '" verliert Premium.\nHinweis: Ein in Stripe noch aktives Abo würde bei der nächsten Verlängerung erneut Premium setzen — dort separat kündigen.',
      confirmLabel: 'Zurücksetzen',
      danger: true,
    });
    if (!ok) return;
    try {
      await api('/admin/users/' + userId + '/entitlement/reset', { method: 'POST' });
      flash('ok', 'Konto „' + email + '" wurde auf Kostenlos zurückgesetzt.');
      await loadAdminUsers();
      // Betrifft es das eigene Konto, die Anzeige oben gleich mitziehen.
      if (account && account.user && account.user.id === userId) {
        account = await window.DNL.currentAccount();
        const badge = $('#plan-badge');
        if (account && badge) { badge.className = 'badge free'; badge.textContent = 'Kostenlos'; }
        await loadCompendium();
      }
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
