import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import { env } from '../config/env';

/**
 * Serverseitige Sessions im MariaDB/MySQL-Store. Keine Tokens/Geheimnisse im
 * Client — der Browser erhält ausschliesslich ein httpOnly/secure/sameSite-Cookie
 * mit der Session-ID.
 */
const MySQLStore = MySQLStoreFactory(session);

/** Zerlegt die DATABASE_URL in die Verbindungsoptionen des Session-Stores. */
function connectionOptionsFromUrl(databaseUrl: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
}

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 Tage

export const sessionMiddleware = session({
  name: 'dnl.sid',
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  // Eigener Pool für den Session-Store (Prisma verwaltet seinen eigenen).
  store: new MySQLStore({
    ...connectionOptionsFromUrl(env.DATABASE_URL),
    // Tabelle wird von Prisma-Migrationen verwaltet.
    createDatabaseTable: false,
    // Abgelaufene Sessions periodisch aufräumen.
    clearExpired: true,
    checkExpirationInterval: 1000 * 60 * 15,
    expiration: SESSION_MAX_AGE_MS,
    schema: {
      tableName: 'session',
      columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' },
    },
  }),
  cookie: {
    httpOnly: true,
    secure: env.isProd, // Produktion: nur über HTTPS
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  },
});
