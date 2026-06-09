import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import type { Request } from 'express';

/**
 * Minimaler Logger. Schreibt strukturierte Zeilen in die Konsole und persistiert
 * Sicherheitsereignisse schlank in der DB — OHNE sensible Inhalte
 * (keine Passwörter, keine Tokens, keine Drittkonten-Geheimnisse).
 */

type Level = 'info' | 'warn' | 'error';

function log(level: Level, msg: string, meta?: Record<string, unknown>): void {
  if (env.isTest) return; // Tests nicht zumüllen
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(meta ?? {}) });
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](line);
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
};

export function clientIp(req: Request): string | undefined {
  // Hinter Reverse-Proxy ist trust proxy gesetzt; req.ip ist dann korrekt.
  return req.ip;
}

/**
 * Sicherheitsereignis persistieren. Schlägt das Schreiben fehl, darf der
 * Request-Flow nicht brechen — daher best-effort.
 */
export async function recordSecurityEvent(params: {
  type: string;
  userId?: string | null;
  req?: Request;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        type: params.type,
        userId: params.userId ?? null,
        ip: params.req ? clientIp(params.req) ?? null : null,
        userAgent: params.req?.get('user-agent')?.slice(0, 512) ?? null,
        meta: params.meta ? (params.meta as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (err) {
    logger.error('securityEvent_write_failed', { type: params.type });
  }
}
