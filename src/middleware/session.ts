import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import { env } from '../config/env';

/**
 * Serverseitige Sessions im Postgres-Store. Keine Tokens/Geheimnisse im Client —
 * der Browser erhält ausschliesslich ein httpOnly/secure/sameSite-Cookie mit der
 * Session-ID.
 */
const PgStore = connectPgSimple(session);

// Eigener Pool für den Session-Store (Prisma verwaltet seinen eigenen Pool).
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

export const sessionMiddleware = session({
  name: 'dnl.sid',
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: new PgStore({
    pool,
    tableName: 'session',
    // Tabelle wird von Prisma-Migrationen verwaltet.
    createTableIfMissing: false,
    pruneSessionInterval: 60 * 15,
  }),
  cookie: {
    httpOnly: true,
    secure: env.isProd, // Produktion: nur über HTTPS
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 Tage
    path: '/',
  },
});
