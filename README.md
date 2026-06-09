# diginachlass.ch — Backend, Userverwaltung & Zahlungen

KI-gestützte Plattform zur Organisation des **digitalen Nachlasses**. Dieses
Repository enthält die öffentliche Marketing-Seite (`index.html`) sowie ein
produktionsnahes **Node.js/TypeScript-Backend** mit vollständiger
**Userverwaltung**, **Stripe-Zahlungen** und serverseitigem **Premium-Gating**.

> **Sensibles Thema (Tod, Vorsorge).** Vertrauen, Seriosität und Datenschutz
> stehen im Zentrum. **Es werden niemals Zugangsdaten oder Geheimnisse von
> Drittkonten gespeichert** — nur Metadaten und ob ein Zugang dokumentiert ist
> (`ja|teilweise|nein`).

---

## Inhalt

- [Tech-Stack & Entscheidungen](#tech-stack--entscheidungen)
- [Projektstruktur](#projektstruktur)
- [Schnellstart (lokal)](#schnellstart-lokal)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Stripe einrichten (Test-Modus)](#stripe-einrichten-test-modus)
- [Datenmodell](#datenmodell)
- [API-Endpunkte](#api-endpunkte)
- [Premium-Gating](#premium-gating)
- [Sicherheit & Datenschutz](#sicherheit--datenschutz)
- [Frontend & Admin](#frontend--admin)
- [Tests](#tests)
- [Deployment in der Schweiz (Infomaniak)](#deployment-in-der-schweiz-infomaniak)
- [Leitplanken](#leitplanken)

---

## Tech-Stack & Entscheidungen

| Bereich | Wahl | Begründung |
|---|---|---|
| Sprache | **TypeScript** (Node 20+ LTS) | Typensicherheit über das ganze Backend. |
| Web-Framework | **Express** | Reifes Ökosystem; `helmet`, `express-session`, `connect-pg-simple`, `express-rate-limit` decken die Anforderungen direkt ab. Fastify wäre ebenfalls möglich, brächte hier aber keinen Mehrwert. |
| DB & Zugriff | **PostgreSQL + Prisma** | Migrationen, Typsicherheit, ausschliesslich parametrisierte Queries (SQL-Injection-Schutz). |
| Auth | **Eigene Implementierung**, `argon2id`, **serverseitige Sessions** | Volle Kontrolle; keine Tokens/Geheimnisse im `localStorage`. Session-ID nur im httpOnly/secure/sameSite-Cookie; Session-Daten im Postgres-Store. |
| 2FA | **TOTP** (`otplib`) | Authenticator-App; Secret AES-256-GCM-verschlüsselt gespeichert. |
| E-Mail | `nodemailer` über **SMTP** | Verifizierung, Passwort-Reset, Belege. Ohne SMTP-Konfiguration: Konsolen-Fallback (Entwicklung). |
| Zahlungen | **Stripe** hinter `PaymentProvider`-Interface | Stripe Billing (Abo) + Checkout (Einmalzahlung), Webhooks mit Signaturprüfung. Austauschbar (z. B. später Payrexx). |
| Härtung | `zod`, Rate-Limiting + Lockout, Helmet (CSP), CSRF (Synchronizer-Token) | — |

**Provider-Abstraktion:** `src/payments/PaymentProvider.ts` definiert
`createCheckout`, `handleWebhook`, `cancelSubscription`, `getStatus` (+ Portal).
`StripeProvider` ist die erste Implementierung; ein PSP-Wechsel bleibt lokal
begrenzt (`src/payments/index.ts`).

---

## Projektstruktur

```
index.html                 Öffentliche, selbsttragende Marketing-Seite (bleibt an der Wurzel)
content.json               Optional — wird von index.html gefetcht; sonst eingebaute Defaults
prisma/schema.prisma       Datenmodell + Migrationen
src/
  config/env.ts            zod-validierte ENV-Konfiguration
  db/prisma.ts             Prisma-Client
  lib/                     password (argon2), crypto (AES-GCM), tokens, totp, mailer, emails, receipts, logger
  middleware/              session, auth, premium-gating, csrf, rateLimit, validate, error
  services/                auth, twoFactor, account (DSG-Export/Löschung), entitlement, compendium
  payments/                PaymentProvider (Interface) + StripeProvider + Factory
  routes/                  auth, account, nachlassAccounts, trustedPersons, compendium, analysis(Stub), billing, webhooks, admin
  scripts/createAdmin.ts   Bootstrap eines Administrators
  app.ts / server.ts       Express-App + Start
public/
  app/                     login, register, verify-email, reset-password, account, upgrade (deutsch, gleiche Design-Sprache)
  assets/                  app.css, app.js, account.js
  datenschutz.html, impressum.html
tests/                     Vitest: auth, entitlement, webhook (+ Setup)
```

---

## Schnellstart (lokal)

Voraussetzungen: **Node 20+**, **PostgreSQL 14+**.

```bash
# 1) Abhängigkeiten
npm install

# 2) Konfiguration
cp .env.example .env
#   DATABASE_URL, SESSION_SECRET, ENCRYPTION_KEY setzen
#   (SESSION_SECRET/ENCRYPTION_KEY z. B. via: openssl rand -hex 32)

# 3) Datenbank-Schema anwenden
npx prisma migrate deploy        # oder: npm run prisma:migrate:dev

# 4) Administrator anlegen (für das Inhalts-Admin-Panel der Landingpage)
npm run admin:create -- admin@diginachlass.ch 'EinSicheresPasswort1'

# 5) Starten
npm run dev                      # http://localhost:3000
# Produktion:  npm run build && npm start
```

---

## Umgebungsvariablen

Siehe **`.env.example`** für die vollständige, kommentierte Liste. Kurzfassung:

- `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `APP_BASE_URL`, `TRUST_PROXY`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_LIFETIME`

Geheimnisse **nur** via ENV. `.env` ist in `.gitignore` — **niemals echte
Secrets committen.** In Produktion sind `SESSION_SECRET`/`ENCRYPTION_KEY`
Pflicht; lokal werden sonst temporäre Zufallswerte mit Warnung verwendet.

---

## Stripe einrichten (Test-Modus)

1. **Test-Modus** im Stripe-Dashboard aktivieren, Test-Keys in `.env` setzen.
2. Drei **Price-Objekte** anlegen (Währung **CHF**), Beträge direkt am Price
   setzen (Richtwerte): monatliches Abo **~CHF 4.90**, jährliches Abo
   **~CHF 49.00**, Einmalzahlung/lifetime **~CHF 99.00**. Price-IDs in die ENV
   (`STRIPE_PRICE_*`).
3. **Stripe Tax bleibt deaktiviert** (kein MwSt-Ausweis).
4. **Twint** in den Zahlungsmethoden aktivieren (greift nur bei der
   Einmalzahlung — Stripe unterstützt mit Twint **keine** Abos).
5. **Webhook** lokal testen:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   # Das ausgegebene whsec_... in STRIPE_WEBHOOK_SECRET eintragen.
   ```
   Relevante Events: `checkout.session.completed`, `invoice.paid`,
   `invoice.payment_failed`, `customer.subscription.updated`,
   `customer.subscription.deleted`.

**Ablauf:** Backend erstellt eine Checkout-Session → Redirect zu Stripe →
**Bestätigung ausschliesslich serverseitig per signiertem Webhook**
(`constructEvent`, Raw-Body) → Entitlement setzen + Beleg-Mail. Dem
Erfolgs-Redirect wird **nie** allein vertraut.

**Datenstandort-Hinweis:** Stripe verarbeitet Zahlungsdaten ausserhalb der
Schweiz (Irland/USA). An Stripe gehen nur Zahlungs-/Abrechnungsdaten (Betrag,
Zahlungsmittel, Name, E-Mail) — **keine Nachlassdaten**. In der
Datenschutzerklärung ausgewiesen.

---

## Datenmodell

Tabellen (siehe `prisma/schema.prisma`): `users`, `email_verifications`,
`password_resets`, `session` (Postgres-Session-Store), `totp_secrets`,
`nachlass_accounts`, `trusted_persons`, `entitlements`, `payments`,
`security_events`, `counters` (fortlaufende Belegnummern).

> **Scope-Regel (nicht verhandelbar):** `nachlass_accounts` speichert nur
> Metadaten (Dienst, Kategorie, Relevanz `niedrig|mittel|hoch`, Zugang
> dokumentiert `ja|teilweise|nein`, Notizen). **Es gibt bewusst kein Feld für
> Passwörter/Zugangsdaten** — weder in DB, API noch UI. MwSt-Felder in
> `payments` sind vorbereitet, aber inaktiv (`vatAmount=0`, `vatRate=0`).

---

## API-Endpunkte

**Auth** (`/api/auth`): `POST /register`, `/verify-email`, `/login`, `/logout`,
`/password-reset/request`, `/password-reset/confirm`, `/2fa/setup`,
`/2fa/verify`, `/2fa/disable`.

**Konto** (`/api/account`): `GET` (Profil + Entitlement), `PATCH` (Name/E-Mail/
Passwort), `DELETE` (Kontolöschung), `GET /export` (Datenexport JSON).

**Nachlassdaten:** CRUD unter `/api/accounts` (Dienste, verifizierte Nutzer) und
`/api/trusted-persons` (**Premium**). Compendium: `GET /api/compendium/preview`
(frei), `GET /api/compendium` (**Premium**, inkl. Risikoanalyse &
Vollständigkeitsprüfung).

**Zahlungen** (`/api/billing`): `POST /checkout` (`{interval: monthly|yearly|
lifetime}`), `POST /portal`, `POST /cancel`, `GET /status`. Webhook:
`POST /api/webhooks/stripe` (Raw-Body, Signaturprüfung, **kein** CSRF).

**Admin** (`/api/admin`, Rolle `admin`): `GET /me`, `GET /users`.

**Stub:** `POST /api/analysis` (KI-Analyse — bewusst nicht ausimplementiert,
`501`).

**CSRF:** `GET /api/csrf` liefert das Token; zustandsändernde Requests müssen es
im Header `x-csrf-token` mitschicken.

---

## Premium-Gating

| Kostenlos | Premium |
|---|---|
| Geführte Erfassung der Dienste (`/api/accounts`) | Vollständiges Compendium (`GET /api/compendium`) |
| Basis-Vorschau (`/api/compendium/preview`) | KI-Risikoanalyse & Vollständigkeitsprüfung |
| — | Export (im Konto), Verwaltung der Vertrauenspersonen (`/api/trusted-persons`) |

Durchgesetzt **serverseitig** per Middleware (`requirePremium`). Free-Nutzer
erhalten auf geschützten Endpunkten **HTTP 402** mit Upgrade-Hinweis
(`code: PREMIUM_ERFORDERLICH`). Das Frontend spiegelt den Status sichtbar
(Badge „Kostenlos“/„Premium“).

---

## Sicherheit & Datenschutz

- **Passwörter:** `argon2id` (OWASP-Parameter). Starke Passwort-Policy mit
  deutschen Fehlermeldungen.
- **Sessions:** serverseitig (Postgres-Store), httpOnly/secure/sameSite-Cookie,
  Session-Regeneration beim Login (Fixation-Schutz).
- **CSRF:** Synchronizer-Token in der Session; Webhook ausgenommen (Signatur).
- **Rate-Limiting + Lockout:** API-/Auth-Limiter; temporäre Kontosperre nach 5
  Fehlversuchen.
- **Header:** Helmet inkl. CSP (erlaubt nur das Nötige für die bestehende
  `index.html` und Google Fonts).
- **Validierung:** `zod` an jeder Eingabe; Prisma → parametrisierte Queries.
- **Nicht-Enumeration:** Registrierung und Passwort-Reset antworten generisch.
- **TOTP-Secret** AES-256-GCM-verschlüsselt (`ENCRYPTION_KEY`).
- **DSG/DSGVO:** Datenexport (JSON) + permanente Kontolöschung (kaskadierend,
  kündigt laufendes Stripe-Abo).
- **Logging:** schlanke Sicherheitsereignisse ohne sensible Inhalte.
- **Verschlüsselung at rest + TLS** werden vorausgesetzt (siehe Deployment).

---

## Frontend & Admin

- `index.html` + (optionale) `content.json` bleiben die **öffentliche**
  Marketing-Seite. Exportiert das Admin-Panel eine `content.json`, kann sie in
  die Projektwurzel gelegt werden — sie wird unter `/content.json` ausgeliefert.
- Neue deutschsprachige App-Seiten unter `/app/*` in derselben Design-Sprache
  (Fraunces / Hanken Grotesk / Spline Sans Mono; Papier/Forest-Petrol/Clay;
  Grain). Die Pricing-Sektion ist mit Registrierung (Free) bzw. Upgrade/Checkout
  (Premium, Abo **und** Einmalzahlung) verbunden.
- **Admin-Panel:** Der frühere Prototyp-Passcode (`1234`) wurde **entfernt**.
  Das Inhalts-Panel entsperrt jetzt nur mit einem echten Konto der Rolle
  `admin` (Login gegen `/api/auth/login`, Prüfung gegen `/api/admin/me`).

---

## Tests

```bash
npm test          # Vitest (Unit + Integration)
npm run typecheck # tsc --noEmit
```

Abgedeckt: Auth-Flow (Registrierung/Verifizierung/Login/Reset, Lockout,
Nicht-Enumeration, CSRF), Entitlement-Logik (`isPremiumActive`),
Webhook-Verarbeitung (lifetime/Abo, Idempotenz, Kündigung, Zahlungsausfall),
Gating (402) und DSG-Funktionen (Export/Löschung).

> Die Tests nutzen eine separate Test-DB (Default
> `…/diginachlass_test`, via `TEST_DATABASE_URL` überschreibbar) und wenden
> Migrationen automatisch an.

**Manuelle Test-Checkliste (Stripe-Test-Modus):**
registrieren → verifizieren → einloggen → Premium kaufen als **Abo**
(Testkarte `4242 4242 4242 4242`) *und* als **Einmalzahlung** (Twint-Test bzw.
Testkarte) → Entitlement wird **per Webhook** gesetzt → geschützte Funktion
freigeschaltet → über Customer Portal kündigen → Entitlement entzogen → Daten
exportieren → Konto löschen.

---

## Deployment in der Schweiz (Infomaniak)

> **Hinweis:** Dieses Repo führt **kein** Deployment aus und enthält **keine**
> Live-Credentials. Server **und** Datenbank in der **Schweiz** betreiben.

**Variante A — Public Cloud (Managed):**
1. **Managed PostgreSQL** (Standort CH) bereitstellen; `DATABASE_URL` mit
   `sslmode=require`. Verschlüsselung at rest aktivieren.
2. Node-App als Container/Instanz; `npm ci && npm run build`, Start
   `node dist/server.js`. `NODE_ENV=production`, `TRUST_PROXY=true`.
3. **TLS** am Reverse-Proxy/Load-Balancer terminieren (Let’s Encrypt). Secure-
   Cookies funktionieren nur über HTTPS.

**Variante B — VPS (Infomaniak):**
1. Ubuntu-VPS (Rechenzentrum CH), PostgreSQL lokal oder Managed.
   **Festplattenverschlüsselung** (LUKS) aktivieren → Verschlüsselung at rest.
2. App via `systemd`-Service (`node dist/server.js`), ENV als
   EnvironmentFile (Rechte `600`).
3. **Nginx** als Reverse-Proxy mit TLS (Certbot), Proxy auf `127.0.0.1:3000`,
   Header `X-Forwarded-*` setzen (`TRUST_PROXY=true`).
4. **SMTP** über Infomaniak-Mailserver (`SMTP_FROM` = verifizierte Absender-
   Adresse).
5. **Stripe-Webhook** im Dashboard auf
   `https://<domain>/api/webhooks/stripe` registrieren; `whsec_...` in die ENV.
6. Migrationen beim Deploy: `npx prisma migrate deploy`.

Allgemein: regelmässige DB-Backups (verschlüsselt), Monitoring auf
`/api/health`, Secrets ausschliesslich über ENV/Secret-Store.

---

## Leitplanken

- **Kein** Deployment, **keine** DNS-Änderungen, **keine** Live-Credentials —
  nur Stripe **Test-Modus** und ENV-Platzhalter.
- **Niemals** Drittkonten-Geheimnisse oder echte Secrets speichern/committen.
- Bestehende `index.html` / `content.json` bleiben funktionsfähig.
- Alles Nutzersichtbare ist **auf Deutsch**.
