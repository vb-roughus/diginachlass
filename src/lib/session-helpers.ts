import type { Request } from 'express';

/**
 * Session beim Login neu generieren (Schutz vor Session-Fixation) und Nutzer
 * setzen. Der CSRF-Token wird neu vergeben.
 */
export function loginSession(req: Request, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.loginAt = Date.now();
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}
