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
    await Promise.all([loadCompendium(), loadAccounts(), loadTrusted()]);
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
      if (!items.length) { el.innerHTML = '<p class="muted">Noch keine Dienste erfasst.</p>'; return; }
      el.innerHTML = items.map((a) =>
        '<div class="item"><div class="top"><span class="name">' + escapeHtml(a.serviceName) + '</span>' +
        '<button class="btn btn-ghost btn-sm" data-del="' + a.id + '">Löschen</button></div>' +
        '<div class="meta">' + escapeHtml(CAT_LABELS[a.category] || a.category) + ' · Relevanz: ' + a.relevance +
        ' · Zugang: ' + a.accessDocumented + '</div>' +
        (a.notes ? '<div class="muted" style="margin-top:6px">' + escapeHtml(a.notes) + '</div>' : '') +
        '</div>'
      ).join('');
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

  // ---- Logout --------------------------------------------------------------
  $('#logout').addEventListener('click', async (e) => {
    e.preventDefault();
    try { await api('/auth/logout', { method: 'POST' }); } catch (_) {}
    location.href = '/';
  });

  init();
})();
