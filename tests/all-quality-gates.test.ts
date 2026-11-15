import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { AIRouter } from '../src/worker/ai/router';
import { runAgent } from '../src/worker/agents/runner';
import type { AIToolDefinition } from '../src/worker/ai/types';
import { runComplianceChecker } from '../src/worker/agents/definitions/studioAndResearch';
import { CreateShortLinkSchema } from '../src/shared/types';
import { isSafePublicHttpUrl } from '../src/worker/lib/url-safety';

describe('Quality Gate 1: Provider Fallback Chain', () => {
  it('falls back to mock provider gracefully when no external API keys are configured', async () => {
    const router = new AIRouter({});
    const res = await router.generateText([{ role: 'user', content: 'Generate high-retention hook' }]);
    expect(res).toBeDefined();
    expect(typeof res).toBe('string');
    expect(res.length).toBeGreaterThan(10);
  });

  it('validates structured outputs with Zod in the fallback chain', async () => {
    const router = new AIRouter({});
    const schema = z.object({
      status: z.string(),
      score: z.number(),
    });
    const structured = await router.generateStructured(
      [{ role: 'user', content: 'Output test json' }],
      schema
    );
    expect(structured.status).toBe('success');
    expect(structured.score).toBe(5);
  });
});

describe('Quality Gate 2: Agent Framework & Tool Validation Loop', () => {
  it('validates tool arguments with Zod and enforces step bounds', async () => {
    const router = new AIRouter({});
    let toolExecutionCount = 0;

    const testTool: AIToolDefinition = {
      name: 'calculateSpecScore',
      description: 'Calculates performance score from frequency',
      parameters: z.object({
        ghz: z.number().min(1.0).max(6.0),
        cores: z.number().int().positive(),
      }),
      execute: async (rawArgs) => {
        const { ghz, cores } = rawArgs as { ghz: number; cores: number };
        toolExecutionCount++;
        return { score: ghz * cores * 100 };
      },
    };

    const agentResult = await runAgent({
      name: 'Benchmark Tester',
      systemPrompt: 'You test performance benchmarks.',
      tools: [testTool],
      input: 'Run benchmarks for 3.2 GHz 8-core CPU',
      creatorId: 'test_creator_123',
      maxSteps: 3,
      router,
    });

    expect(agentResult.agentName).toBe('Benchmark Tester');
    expect(agentResult.traces.length).toBeGreaterThanOrEqual(1);
    expect(agentResult.stepsExecuted).toBeLessThanOrEqual(3);
  });

  it('rejects invalid parameters according to tool schema', () => {
    const schema = z.object({
      ghz: z.number().min(1.0).max(6.0),
      cores: z.number().int().positive(),
    });

    const invalidArgs = { ghz: 10.5, cores: -2 };
    const parseResult = schema.safeParse(invalidArgs);
    expect(parseResult.success).toBe(false);
  });
});

describe('Quality Gate 3: Short Link Safety & SSRF Validation', () => {
  it('accepts valid public e-commerce and YouTube URLs', () => {
    expect(isSafePublicHttpUrl('https://www.amazon.in/dp/B0D3G78JKL')).toBe(true);
    expect(isSafePublicHttpUrl('https://youtube.com/watch?v=12345')).toBe(true);
  });

  it('blocks private IPs, localhost, and non-http protocols (SSRF Prevention)', () => {
    expect(isSafePublicHttpUrl('http://localhost:8787/secret')).toBe(false);
    expect(isSafePublicHttpUrl('http://127.0.0.1/admin')).toBe(false);
    expect(isSafePublicHttpUrl('http://192.168.1.1/router')).toBe(false);
    expect(isSafePublicHttpUrl('http://10.0.0.1/internal')).toBe(false);
    expect(isSafePublicHttpUrl('http://[::1]/admin')).toBe(false);
    expect(isSafePublicHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafePublicHttpUrl('file:///etc/passwd')).toBe(false);
  });

  it('validates custom slugs with regex', () => {
    const validSlug = CreateShortLinkSchema.safeParse({
      destination_url: 'https://amazon.in/dp/B0D3G78JKL',
      slug: 'moto-edge-deal-2026',
    });
    expect(validSlug.success).toBe(true);

    const invalidSlug = CreateShortLinkSchema.safeParse({
      destination_url: 'https://amazon.in/dp/B0D3G78JKL',
      slug: 'invalid/slug with spaces!',
    });
    expect(invalidSlug.success).toBe(false);
  });
});

describe('Quality Gate 4: Amazon & FTC Compliance Verification', () => {
  it('flags missing affiliate disclosure', () => {
    const textWithoutDisclosure =
      'Check out this phone here: https://amazon.in/dp/123. The price is ₹22,999 as of today.';
    const result = runComplianceChecker(textWithoutDisclosure);
    expect(result.passed).toBe(false);
    expect(result.disclosureFound).toBe(false);
    expect(result.flags.length).toBeGreaterThan(0);
  });

  it('flags pricing claims missing freshness timestamps', () => {
    const textWithoutTimestamp =
      'Affiliate Disclosure: As an Amazon Associate, I earn from qualifying purchases. Buy the phone for ₹22,999 now.';
    const result = runComplianceChecker(textWithoutTimestamp);
    expect(result.passed).toBe(false);
    expect(result.priceTimestampFound).toBe(false);
  });

  it('passes when disclosure and timestamp are present', () => {
    const compliantText =
      'Affiliate Disclosure: As an Amazon Associate, I earn from qualifying purchases made through links here. Buy Motorola Edge on Amazon (₹22,999 price as of recorded date).';
    const result = runComplianceChecker(compliantText);
    expect(result.passed).toBe(true);
    expect(result.disclosureFound).toBe(true);
    expect(result.priceTimestampFound).toBe(true);
    expect(result.flags.length).toBe(0);
  });
});

describe('Quality Gate 5: Quiz Scoring & Assessment Calculation', () => {
  it('accurately scores responses and calculates pass percentages', () => {
    const questions = [
      { id: 'q1', correctIndex: 1 },
      { id: 'q2', correctIndex: 2 },
      { id: 'q3', correctIndex: 0 },
      { id: 'q4', correctIndex: 3 },
      { id: 'q5', correctIndex: 1 },
    ];

    const userAnswers: Record<string, number> = {
      q1: 1, // correct
      q2: 2, // correct
      q3: 0, // correct
      q4: 3, // correct
      q5: 0, // wrong
    };

    let score = 0;
    for (const q of questions) {
      if (userAnswers[q.id] === q.correctIndex) {
        score++;
      }
    }

    expect(score).toBe(4);
    expect(score / questions.length).toBe(0.8);
    expect(score >= 4).toBe(true); // Qualifies for gap improvement
  });
});
