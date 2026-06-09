import { describe, it, expect } from 'vitest';
import { isPremiumActive } from '../src/services/entitlement';

type Ent = Parameters<typeof isPremiumActive>[0];

const now = new Date('2026-06-09T00:00:00Z');
const future = new Date('2026-12-31T00:00:00Z');
const past = new Date('2026-01-01T00:00:00Z');

describe('isPremiumActive', () => {
  it('null/kein Entitlement => kein Premium', () => {
    expect(isPremiumActive(null, now)).toBe(false);
  });

  it('Free-Plan => kein Premium', () => {
    const e: Ent = { plan: 'free', type: null, status: 'none', validUntil: null };
    expect(isPremiumActive(e, now)).toBe(false);
  });

  it('Lifetime aktiv => Premium', () => {
    const e: Ent = { plan: 'premium', type: 'lifetime', status: 'active', validUntil: null };
    expect(isPremiumActive(e, now)).toBe(true);
  });

  it('Lifetime ohne active-Status => kein Premium', () => {
    const e: Ent = { plan: 'premium', type: 'lifetime', status: 'canceled', validUntil: null };
    expect(isPremiumActive(e, now)).toBe(false);
  });

  it('Abo active mit Zukunft-validUntil => Premium', () => {
    const e: Ent = { plan: 'premium', type: 'subscription', status: 'active', validUntil: future };
    expect(isPremiumActive(e, now)).toBe(true);
  });

  it('Abo active mit abgelaufenem validUntil => kein Premium', () => {
    const e: Ent = { plan: 'premium', type: 'subscription', status: 'active', validUntil: past };
    expect(isPremiumActive(e, now)).toBe(false);
  });

  it('Abo trialing => Premium', () => {
    const e: Ent = { plan: 'premium', type: 'subscription', status: 'trialing', validUntil: future };
    expect(isPremiumActive(e, now)).toBe(true);
  });

  it('Abo past_due => kein Premium', () => {
    const e: Ent = { plan: 'premium', type: 'subscription', status: 'past_due', validUntil: future };
    expect(isPremiumActive(e, now)).toBe(false);
  });

  it('Abo canceled => kein Premium', () => {
    const e: Ent = { plan: 'premium', type: 'subscription', status: 'canceled', validUntil: future };
    expect(isPremiumActive(e, now)).toBe(false);
  });

  it('Abo active ohne validUntil => Premium', () => {
    const e: Ent = { plan: 'premium', type: 'subscription', status: 'active', validUntil: null };
    expect(isPremiumActive(e, now)).toBe(true);
  });
});
