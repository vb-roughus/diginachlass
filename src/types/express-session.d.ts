import 'express-session';

declare module 'express-session' {
  interface SessionData {
    /** Vollständig authentifizierter Nutzer. */
    userId?: string;
    /** Nutzer hat Passwort bestanden, aber 2FA steht noch aus. */
    pendingTwoFactorUserId?: string;
    /** Synchronizer-Token für CSRF-Schutz. */
    csrfToken?: string;
    /** Zeitpunkt des Logins (für Session-Hygiene/Logging). */
    loginAt?: number;
  }
}
