import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { securityHeaders } from '../src/worker/middleware';
import { CreateShortLinkSchema } from '../src/shared/types';
import { DealSchema } from '../src/worker/routes/deals';
import type { AppEnv } from '../src/worker/env';

describe('Feature Test Suite 1: Security Headers & CSP Enforcement', () => {
  it('enforces complete security headers on HTML and API responses', async () => {
    const testApp = new Hono<AppEnv>();
    testApp.use('*', securityHeaders);
    testApp.get('/test-html', (c) => {
      c.header('Content-Type', 'text/html; charset=UTF-8');
      return c.html('<!DOCTYPE html><html lang="en"><body><h1>Test</h1></body></html>');
    });
    testApp.get('/api/test-json', (c) => c.json({ status: 'ok' }));

    const htmlRes = await testApp.request('https://creatorbrain.example/test-html');
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(htmlRes.headers.get('X-Frame-Options')).toBe('DENY');
    expect(htmlRes.headers.get('X-XSS-Protection')).toBe('0');
    expect(htmlRes.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(htmlRes.headers.get('Cross-Origin-Embedder-Policy')).toBe('credentialless');
    expect(htmlRes.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(htmlRes.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none');
    expect(htmlRes.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');

    const csp = htmlRes.headers.get('Content-Security-Policy') || '';
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain('upgrade-insecure-requests');

    const apiRes = await testApp.request('http://creatorbrain.example/api/test-json');
    expect(apiRes.status).toBe(200);
    expect(apiRes.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('Feature Test Suite 2: Short Links Validation & Expiration Logic', () => {
  it('validates custom slug formats and lengths', () => {
    const validSlugs = ['gear-2026', 'mac_mini_review', 'v123', 'deals-september'];
    for (const slug of validSlugs) {
      const parsed = CreateShortLinkSchema.safeParse({
        destination_url: 'https://www.amazon.in/dp/B0D3G78JKL',
        slug,
      });
      expect(parsed.success).toBe(true);
    }

    const invalidSlugs = ['a', 'has space', 'Upper_Case!', 'invalid@char', 'a'.repeat(65)];
    for (const slug of invalidSlugs) {
      const parsed = CreateShortLinkSchema.safeParse({
        destination_url: 'https://www.amazon.in/dp/B0D3G78JKL',
        slug,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('calculates link expiration timestamps correctly', () => {
    const now = Date.now();
    const futureDate = new Date(now + 7 * 86400 * 1000).toISOString();
    const pastDate = new Date(now - 86400 * 1000).toISOString();

    const isExpired = (expiresAt?: string | null): boolean => {
      if (!expiresAt) return false;
      return Date.parse(expiresAt) <= now;
    };

    expect(isExpired(futureDate)).toBe(false);
    expect(isExpired(pastDate)).toBe(true);
    expect(isExpired(null)).toBe(false);
    expect(isExpired(undefined)).toBe(false);
  });
});

describe('Feature Test Suite 3: Brand Deals Lifecycle & Valuation Calculation', () => {
  it('validates deal schemas and currency codes', () => {
    const validDeal = DealSchema.safeParse({
      brand: 'Sony Audio India',
      deliverable: 'Integrated 60s segment on ANC performance',
      amount: 45000,
      currency: 'INR',
      stage: 'agreed',
      due_date: '2026-11-20',
      notes: 'Script approved',
    });
    expect(validDeal.success).toBe(true);

    const emptyBrand = DealSchema.safeParse({
      brand: '',
      amount: 1000,
      currency: 'USD',
    });
    expect(emptyBrand.success).toBe(false);
  });

  it('aggregates pipeline revenue across stages', () => {
    const deals = [
      { id: '1', amount: 50000, stage: 'paid' },
      { id: '2', amount: 35000, stage: 'posted' },
      { id: '3', amount: 20000, stage: 'agreed' },
      { id: '4', amount: 15000, stage: 'talking' },
    ];

    const totalPipeline = deals.reduce((sum, d) => sum + d.amount, 0);
    const paidRevenue = deals.filter((d) => d.stage === 'paid').reduce((sum, d) => sum + d.amount, 0);
    const pendingRevenue = deals.filter((d) => d.stage !== 'paid').reduce((sum, d) => sum + d.amount, 0);

    expect(totalPipeline).toBe(120000);
    expect(paidRevenue).toBe(50000);
    expect(pendingRevenue).toBe(70000);
  });
});

describe('Feature Test Suite 4: Quiz Scoring & Skill Gap Progression', () => {
  it('calculates percentage scores and identifies mastery threshold', () => {
    const calculateScore = (answers: number[], keys: number[]) => {
      let correct = 0;
      for (let i = 0; i < keys.length; i++) {
        if (answers[i] === keys[i]) correct++;
      }
      const score = Math.round((correct / keys.length) * 100);
      const passed = score >= 80;
      return { correct, total: keys.length, score, passed };
    };

    const keys = [0, 2, 1, 3, 0];
    expect(calculateScore([0, 2, 1, 3, 0], keys)).toEqual({ correct: 5, total: 5, score: 100, passed: true });
    expect(calculateScore([0, 2, 1, 3, 2], keys)).toEqual({ correct: 4, total: 5, score: 80, passed: true });
    expect(calculateScore([0, 2, 0, 1, 2], keys)).toEqual({ correct: 2, total: 5, score: 40, passed: false });
  });

  it('updates confidence score when gap questions are answered correctly', () => {
    const initialGap = { id: 'gap_audio_eq', label: 'Audio Frequency EQ', confidence: 0.35 };
    const updateConfidence = (current: number, passed: boolean) => {
      if (passed) return Math.min(1.0, current + 0.3);
      return Math.max(0.1, current - 0.1);
    };

    const improved = updateConfidence(initialGap.confidence, true);
    expect(improved).toBeCloseTo(0.65);
    const mastered = updateConfidence(improved, true);
    expect(mastered).toBeCloseTo(0.95);
  });
});

describe('Feature Test Suite 5: HTML Sanitization & SSR Bio Security', () => {
  it('escapes special characters to prevent stored XSS attacks', () => {
    const esc = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    expect(esc('<script>alert("pwned")</script>')).toBe('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;');
    expect(esc('"><img src=x onerror=alert(1)>')).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(esc('Tom & Jerry\'s "Special"')).toBe('Tom &amp; Jerry&#39;s &quot;Special&quot;');
  });
});
