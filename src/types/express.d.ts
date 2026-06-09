import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Authentifizierter Nutzer (von loadUser gesetzt), falls eingeloggt. */
      user?: {
        id: string;
        email: string;
        name: string | null;
        role: Role;
        emailVerifiedAt: Date | null;
        totpEnabled: boolean;
      };
    }
  }
}

export {};
